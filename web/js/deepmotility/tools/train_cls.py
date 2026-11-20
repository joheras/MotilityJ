"""Distil the Deep-Motility ResNet50 complete/incomplete classifier (teacher) into ClsStudent.

usage: python3 train_cls.py MODELS_DIR MOTILIDAD_DIR WORK_DIR [--size 384] [--epochs 30]

Training: Clasificacion/dataset/train. Loss = cross-entropy on the label + KL to the teacher's softmax (T = 2).
The valid split is only used for the final report; the last epoch is kept.
"""
import argparse
import os
import sys
import time

import numpy as np
import torch
import torch.nn.functional as F
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import MEAN, STD, load_rgb, to_tensor_np, cls_items, summarize_cls
from students import ClsStudent

ap = argparse.ArgumentParser()
ap.add_argument("models"); ap.add_argument("data"); ap.add_argument("work")
ap.add_argument("--size", type=int, default=384)
ap.add_argument("--epochs", type=int, default=30)
ap.add_argument("--bs", type=int, default=16)
ap.add_argument("--lr", type=float, default=1e-3)
ap.add_argument("--T", type=float, default=2.0)
args = ap.parse_args()
os.makedirs(args.work, exist_ok=True)
dev = "cuda"
S = args.size
torch.manual_seed(0); np.random.seed(0)


def build_cache():
    path = os.path.join(args.work, f"cls_cache_{S}.npz")
    if os.path.exists(path):
        return dict(np.load(path))
    teacher = torch.jit.load(os.path.join(args.models, "resnet50Motility.pth"), map_location=dev).eval()
    grey, logits, ys = [], [], []
    for p, y in cls_items(args.data, "train"):
        img = load_rgb(p)
        with torch.no_grad():
            logits.append(teacher(torch.from_numpy(to_tensor_np(img, 512)).to(dev))[0].float().cpu().numpy())
        grey.append(np.asarray(img.convert("L").resize((S, S), Image.BILINEAR)))
        ys.append(y)
    c = dict(grey=np.stack(grey), logits=np.stack(logits), y=np.array(ys))
    np.savez(path, **c)
    return c


def augment(g):
    k = np.random.randint(4)
    g = np.rot90(g, k)
    if np.random.rand() < 0.5:
        g = g[:, ::-1]
    g = g.astype(np.float32) / 255
    if np.random.rand() < 0.5:
        f = np.random.uniform(0.6, 0.95)
        im = Image.fromarray((g * 255).astype(np.uint8))
        g = np.asarray(im.resize((int(S * f), int(S * f)), Image.BOX).resize((S, S), Image.BILINEAR), np.float32) / 255
    g = np.clip((g - 0.5) * np.random.uniform(0.75, 1.3) + 0.5 + np.random.uniform(-0.1, 0.1), 0, 1)
    g = g ** np.random.uniform(0.75, 1.33)
    return np.ascontiguousarray(g)


def to_input(g):
    x = torch.from_numpy(g)[:, None].repeat(1, 3, 1, 1)
    return (x - torch.tensor(MEAN)[None, :, None, None]) / torch.tensor(STD)[None, :, None, None]


c = build_cache()
n = len(c["y"])
print(f"{n} training images; teacher train accuracy {(c['logits'].argmax(1) == c['y']).mean():.4f}", flush=True)
model = ClsStudent().to(dev)
opt = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=1e-4)
steps = args.epochs * (n // args.bs)
sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=args.lr, total_steps=steps, pct_start=0.1)
t0 = time.time()
for ep in range(args.epochs):
    model.train()
    perm = np.random.permutation(n)
    tot = 0
    for b in range(n // args.bs):
        idx = perm[b * args.bs:(b + 1) * args.bs]
        x = to_input(np.stack([augment(c["grey"][i]) for i in idx])).to(dev)
        y = torch.from_numpy(c["y"][idx]).long().to(dev)
        tl = torch.from_numpy(c["logits"][idx]).to(dev)
        with torch.autocast("cuda", dtype=torch.bfloat16):
            logit = model(x)
        logit = logit.float()
        kd = F.kl_div(F.log_softmax(logit / args.T, 1), F.softmax(tl / args.T, 1), reduction="batchmean") * args.T ** 2
        loss = F.cross_entropy(logit, y, label_smoothing=0.05) + kd
        opt.zero_grad(set_to_none=True)
        loss.backward()
        opt.step(); sched.step()
        tot += loss.item()
    print(f"epoch {ep + 1}/{args.epochs} loss {tot / (n // args.bs):.4f} {time.time() - t0:.0f}s", flush=True)

torch.save(model.state_dict(), os.path.join(args.work, f"cls_student_{S}.pt"))
model.eval()
ys, ps = [], []
for p, y in cls_items(args.data, "valid"):
    with torch.no_grad():
        ps.append(int(model(torch.from_numpy(to_tensor_np(load_rgb(p), S)).to(dev)).argmax(1).item()))
    ys.append(y)
print("valid", summarize_cls(ys, ps))
