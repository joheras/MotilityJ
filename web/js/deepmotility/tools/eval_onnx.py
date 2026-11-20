"""Evaluate ONNX variants with onnxruntime (CPU, 1 thread: the numerics and op set of onnxruntime-web WASM).

usage: python3 eval_onnx.py MOTILIDAD_DIR --seg a.onnx:512 [b.onnx:1002 ...] --cls c.onnx:384 [...] [--json out.json]
Segmentation on Segmentation test (biggest particle, holes filled, like the browser), classification on
Clasificacion valid. Prints size, median latency per image (native single thread) and metrics.
"""
import argparse
import json
import os
import sys
import time

import numpy as np
import onnxruntime as ort
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import cls_items, largest_component, load_rgb, seg_metrics, seg_pairs, summarize_cls, summarize_seg, to_tensor_np

ap = argparse.ArgumentParser()
ap.add_argument("data")
ap.add_argument("--seg", nargs="*", default=[])
ap.add_argument("--cls", nargs="*", default=[])
ap.add_argument("--json")
ap.add_argument("--limit", type=int, default=0)
args = ap.parse_args()


def session(path):
    o = ort.SessionOptions()
    o.intra_op_num_threads = 1
    o.inter_op_num_threads = 1
    o.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
    return ort.InferenceSession(path, o, providers=["CPUExecutionProvider"])


def upsample_logits(z, w, h):
    """Bilinear (align_corners = false) like worker.js; z is S×S (1-channel logit or 2-class difference)."""
    im = Image.fromarray(z.astype(np.float32), mode="F")
    return np.asarray(im.resize((w, h), Image.BILINEAR)) > 0


report = {}
seg_items = seg_pairs(args.data, "test")
cls_list = cls_items(args.data, "valid")
if args.limit:
    seg_items, cls_list = seg_items[:args.limit], cls_list[::max(1, len(cls_list) // args.limit)]

for spec in args.seg:
    path, size = spec.rsplit(":", 1)
    size = int(size)
    s = session(path)
    rows, times = [], []
    for ip, lp in seg_items:
        img = load_rgb(ip)
        gt = np.asarray(Image.open(lp).convert("L")) > 127
        h, w = gt.shape
        x = to_tensor_np(img, size)
        t0 = time.perf_counter()
        out = s.run(None, {"input": x})[0][0]
        times.append(time.perf_counter() - t0)
        z = out[0] if out.shape[0] == 1 else out[1] - out[0]  # student: 1 logit; teacher: 2 classes
        rows.append(seg_metrics(largest_component(upsample_logits(z, w, h)), gt))
    r = summarize_seg(rows)
    r.update(size_mb=os.path.getsize(path) / 1e6, ms=1000 * float(np.median(times)), input=size)
    report[os.path.basename(path)] = r
    print(os.path.basename(path), json.dumps({k: round(v, 4) if isinstance(v, float) else v for k, v in r.items()}), flush=True)

for spec in args.cls:
    path, size = spec.rsplit(":", 1)
    size = int(size)
    s = session(path)
    ys, ps, times = [], [], []
    for ip, y in cls_list:
        x = to_tensor_np(load_rgb(ip), size)
        t0 = time.perf_counter()
        out = s.run(None, {"input": x})[0][0]
        times.append(time.perf_counter() - t0)
        ys.append(y); ps.append(int(np.argmax(out)))
    r = summarize_cls(ys, ps)
    r.update(size_mb=os.path.getsize(path) / 1e6, ms=1000 * float(np.median(times)), input=size)
    report[os.path.basename(path)] = r
    print(os.path.basename(path), json.dumps({k: round(v, 4) if isinstance(v, float) else v for k, v in r.items()}), flush=True)

if args.json:
    with open(args.json, "w") as f:
        json.dump(report, f, indent=1)
