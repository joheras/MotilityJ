"""Evaluate the original Deep-Motility TorchScript models and cache their soft outputs for distillation.

usage: python3 eval_teacher.py MODELS_DIR MOTILIDAD_DIR OUT_DIR [--sizes 1002,512,384,256]

MODELS_DIR holds "HRNet Seg.pth" and "resnet50Motility.pth" (from the Dropbox folder linked in the README).
Writes OUT_DIR/teacher_seg_{train,test}.npz (P(growth) at 256×256, uint8) and OUT_DIR/teacher_cls_{train,valid}.npz
(softmax), and prints the metrics. Preprocessing is the one of deep_motility/predict_seg.py and predict_clas.py.
"""
import argparse
import os
import sys
import json
import numpy as np
import torch
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import (seg_pairs, cls_items, load_rgb, to_tensor_np, largest_component, seg_metrics,
                    summarize_seg, summarize_cls, mask_to_full)

ap = argparse.ArgumentParser()
ap.add_argument("models"); ap.add_argument("data"); ap.add_argument("out")
ap.add_argument("--sizes", default="1002")
ap.add_argument("--cls-sizes", default="512")
args = ap.parse_args()
os.makedirs(args.out, exist_ok=True)
dev = "cuda" if torch.cuda.is_available() else "cpu"
seg = torch.jit.load(os.path.join(args.models, "HRNet Seg.pth"), map_location=dev).eval()
cls = torch.jit.load(os.path.join(args.models, "resnet50Motility.pth"), map_location=dev).eval()
SOFT = 256
report = {}

with torch.no_grad():
    for split in ("test", "train"):
        sizes = [int(s) for s in args.sizes.split(",")] if split == "test" else [1002]
        rows = {s: ([], []) for s in sizes}
        soft = []
        names = []
        for ip, lp in seg_pairs(args.data, split):
            img = load_rgb(ip)
            gt = np.asarray(Image.open(lp).convert("L")) > 127
            h, w = gt.shape
            for s in sizes:
                x = torch.from_numpy(to_tensor_np(img, s)).to(dev)
                prob = torch.softmax(seg(x), 1)[0, 1]
                if s == 1002:
                    soft.append((torch.nn.functional.interpolate(prob[None, None], (SOFT, SOFT), mode="area")[0, 0]
                                 .cpu().numpy() * 255).round().astype(np.uint8))
                if split == "test":
                    m = mask_to_full(prob.cpu().numpy() > 0.5, w, h)  # argmax, resized like predict_seg
                    rows[s][0].append(seg_metrics(m, gt))
                    rows[s][1].append(seg_metrics(largest_component(m), gt))
            names.append(os.path.basename(ip))
        np.savez_compressed(os.path.join(args.out, f"teacher_seg_{split}.npz"), prob=np.stack(soft), names=np.array(names))
        if split == "test":
            for s in sizes:
                report[f"seg@{s} raw"] = summarize_seg(rows[s][0])
                report[f"seg@{s} biggest"] = summarize_seg(rows[s][1])
                print(s, report[f"seg@{s} raw"], report[f"seg@{s} biggest"], flush=True)

    for split in ("valid", "train"):
        sizes = [int(s) for s in args.cls_sizes.split(",")] if split == "valid" else [512]
        preds = {s: [] for s in sizes}
        ys, soft, names = [], [], []
        for ip, y in cls_items(args.data, split):
            img = load_rgb(ip)
            for s in sizes:
                p = torch.softmax(cls(torch.from_numpy(to_tensor_np(img, s)).to(dev)), 1)[0].cpu().numpy()
                preds[s].append(int(p.argmax()))
                if s == 512:
                    soft.append(p)
            ys.append(y); names.append(os.path.basename(ip))
        np.savez_compressed(os.path.join(args.out, f"teacher_cls_{split}.npz"), prob=np.stack(soft), y=np.array(ys), names=np.array(names))
        if split == "valid":
            for s in sizes:
                report[f"cls@{s}"] = summarize_cls(ys, preds[s])
                print(s, report[f"cls@{s}"], flush=True)

with open(os.path.join(args.out, "teacher_metrics.json"), "w") as f:
    json.dump(report, f, indent=1)
