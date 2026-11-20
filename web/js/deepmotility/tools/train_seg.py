"""Distil the Deep-Motility HRNet (teacher) into SegStudent.

usage: python3 train_seg.py MODELS_DIR MOTILIDAD_DIR WORK_DIR [--size 512] [--epochs 60]

Training images: all of Segmentation/dataset/Images/train (1154 photos, 444 of them with a label).
Target = teacher P(growth) (HRNet at its native 1002×1002 input), mixed 50/50 with the ground truth where one exists.
The test split is never used for training or model selection; the last epoch is kept.
Writes WORK_DIR/seg_student.pt and prints the test metrics of the student.
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
from common import MEAN, STD, load_rgb, to_tensor_np, seg_pairs, largest_component, seg_metrics, summarize_seg, mask_to_full
from students import SegStudent

ap = argparse.ArgumentParser()
ap.add_argument("models"); ap.add_argument("data"); ap.add_argument("work")
ap.add_argument("--size", type=int, default=512)
ap.add_argument("--epochs", type=int, default=60)
ap.add_argument("--bs", type=int, default=8)
ap.add_argument("--lr", type=float, default=1e-3)
ap.add_argument("--gt-weight", type=float, default=0.5)
args = ap.parse_args()
os.makedirs(args.work, exist_ok=True)
dev = "cuda"
S = args.size
torch.manual_seed(0); np.random.seed(0)


def build_cache():
    path = os.path.join(args.work, f"seg_cache_{S}.npz")
    if os.path.exists(path):
        return dict(np.load(path))
    teacher = torch.jit.load(os.path.join(args.models, "HRNet Seg.pth"), map_location=dev).eval()
    img_dir = os.path.join(args.data, "Segmentation/dataset/Images/train")
    lab_dir = os.path.join(args.data, "Segmentation/dataset/Labels/train")
    grey, soft, gt, has = [], [], [], []
    for f in sorted(os.listdir(img_dir)):
        img = load_rgb(os.path.join(img_dir, f))
        with torch.no_grad():
            p = torch.softmax(teacher(torch.from_numpy(to_tensor_np(img, 1002)).to(dev)), 1)[:, 1:]
            p = F.interpolate(p, (S, S), mode="area")[0, 0].cpu().numpy()
        grey.append(np.asarray(img.convert("L").resize((S, S), Image.BILINEAR)))
        soft.append((p * 255).round().astype(np.uint8))
        lp = os.path.join(lab_dir, os.path.splitext(f)[0] + ".png")
        has.append(os.path.exists(lp))
        gt.append(np.asarray(Image.open(lp).convert("L").resize((S, S), Image.BILINEAR)) if has[-1] else np.zeros((S, S), np.uint8))
    c = dict(grey=np.stack(grey), soft=np.stack(soft), gt=np.stack(gt), has=np.array(has))
    np.savez(path, **c)
    return c


def augment(g, t):
    """g: grey uint8 HxW, t: target float HxW. Flips/rot90, photometric jitter, and a random resample filter."""
    k = np.random.randint(4)
    g, t = np.rot90(g, k), np.rot90(t, k)
    if np.random.rand() < 0.5:
        g, t = g[:, ::-1], t[:, ::-1]
    g = g.astype(np.float32) / 255
    if np.random.rand() < 0.5:  # down-up resample: robustness to the browser's resize
        f = np.random.uniform(0.6, 0.95)
        im = Image.fromarray((g * 255).astype(np.uint8))
        g = np.asarray(im.resize((int(S * f), int(S * f)), Image.BOX).resize((S, S), Image.BILINEAR), np.float32) / 255
    g = np.clip((g - 0.5) * np.random.uniform(0.75, 1.3) + 0.5 + np.random.uniform(-0.1, 0.1), 0, 1)
    g = g ** np.random.uniform(0.75, 1.33)
    if np.random.rand() < 0.15:
        g = 1 - g  # some photos have inverted contrast
    return np.ascontiguousarray(g), np.ascontiguousarray(t)


def to_input(g):
    x = torch.from_numpy(g)[:, None].repeat(1, 3, 1, 1)
    return (x - torch.tensor(MEAN)[None, :, None, None]) / torch.tensor(STD)[None, :, None, None]


c = build_cache()
n = len(c["grey"])
target = c["soft"].astype(np.float32) / 255
w = args.gt_weight
target[c["has"]] = (1 - w) * target[c["has"]] + w * (c["gt"][c["has"]] > 127)
print(f"{n} training images, {c['has'].sum()} labelled", flush=True)

model = SegStudent().to(dev)
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
        gs, ts = zip(*[augment(c["grey"][i], target[i]) for i in idx])
        x = to_input(np.stack(gs)).to(dev)
        y = torch.from_numpy(np.stack(ts))[:, None].to(dev)
        with torch.autocast("cuda", dtype=torch.bfloat16):
            logit = model(x)
        logit = logit.float()
        p = torch.sigmoid(logit)
        dice = 1 - (2 * (p * y).sum((2, 3)) + 1) / (p.sum((2, 3)) + y.sum((2, 3)) + 1)
        loss = F.binary_cross_entropy_with_logits(logit, y) + dice.mean()
        opt.zero_grad(set_to_none=True)
        loss.backward()
        opt.step(); sched.step()
        tot += loss.item()
    print(f"epoch {ep + 1}/{args.epochs} loss {tot / (n // args.bs):.4f} {time.time() - t0:.0f}s", flush=True)

torch.save(model.state_dict(), os.path.join(args.work, f"seg_student_{S}.pt"))

# ---- test metrics (full label resolution; raw argmax and biggest particle like the Java app)
model.eval()
raw, big = [], []
for ip, lp in seg_pairs(args.data, "test"):
    img = load_rgb(ip)
    gt = np.asarray(Image.open(lp).convert("L")) > 127
    h, wd = gt.shape
    with torch.no_grad():
        p = torch.sigmoid(model(torch.from_numpy(to_tensor_np(img, S)).to(dev)))[0, 0].cpu().numpy()
    m = mask_to_full(p > 0.5, wd, h)
    raw.append(seg_metrics(m, gt)); big.append(seg_metrics(largest_component(m), gt))
print("test raw", summarize_seg(raw))
print("test biggest", summarize_seg(big))
