"""Export the distilled students to ONNX: FP32, FP16, FP16 weights only (fp16w), dynamic INT8 and static INT8 (QDQ, calibrated on train images).

usage: python3 export_student.py MOTILIDAD_DIR WORK_DIR OUT_DIR [--seg-size 512] [--cls-size 384]
reads WORK_DIR/seg_student_{S}.pt and cls_student_{S}.pt; writes OUT_DIR/{seg,cls}{S}_{fp32,fp16,fp16w,int8dyn,int8qdq}.onnx
Input name "input" (1×3×S×S, ImageNet-normalised grey), output "logits".
"""
import argparse
import os
import sys

import numpy as np
import onnx
import torch
from onnxconverter_common import float16
from onnxruntime.quantization import (CalibrationDataReader, QuantFormat, QuantType, quantize_dynamic,
                                      quantize_static)
from onnxruntime.quantization.shape_inference import quant_pre_process

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import cls_items, load_rgb, seg_pairs, to_tensor_np
from students import ClsStudent, SegStudent

ap = argparse.ArgumentParser()
ap.add_argument("data"); ap.add_argument("work"); ap.add_argument("out")
ap.add_argument("--seg-size", type=int, default=512)
ap.add_argument("--cls-size", type=int, default=384)
ap.add_argument("--calib", type=int, default=64)
ap.add_argument("--only", choices=["seg", "cls"])
args = ap.parse_args()
os.makedirs(args.out, exist_ok=True)


def fp16_weights(src, dst):
    """FP16 storage, FP32 compute: every float initializer is stored as float16 and followed by a Cast to
    float32, which onnxruntime folds when the session is created (half the download, FP32 kernels and accuracy)."""
    from onnx import TensorProto, helper, numpy_helper
    m = onnx.load(src)
    g = m.graph
    casts = []
    for init in list(g.initializer):
        if init.data_type != TensorProto.FLOAT or np.prod(init.dims) < 16:
            continue
        a = numpy_helper.to_array(init)
        name = init.name
        g.initializer.remove(init)
        g.initializer.append(numpy_helper.from_array(a.astype(np.float16), name + "_fp16"))
        casts.append(helper.make_node("Cast", [name + "_fp16"], [name], to=TensorProto.FLOAT, name=name + "_cast"))
    for n in reversed(casts):
        g.node.insert(0, n)
    onnx.checker.check_model(m)
    onnx.save(m, dst)


class Reader(CalibrationDataReader):
    def __init__(self, paths, size):
        self.it = iter([{"input": to_tensor_np(load_rgb(p), size)} for p in paths])

    def get_next(self):
        return next(self.it, None)


rng = np.random.default_rng(0)
for name, Net, size, paths in (
        ("seg", SegStudent, args.seg_size, [p for p, _ in seg_pairs(args.data, "train")]),
        ("cls", ClsStudent, args.cls_size, [p for p, _ in cls_items(args.data, "train")])):
    if args.only and name != args.only:
        continue
    m = Net(pretrained=False)
    m.load_state_dict(torch.load(os.path.join(args.work, f"{name}_student_{size}.pt"), map_location="cpu"))
    m.eval()
    fp32 = os.path.join(args.out, f"{name}{size}_fp32.onnx")
    torch.onnx.export(m, torch.zeros(1, 3, size, size), fp32, input_names=["input"], output_names=["logits"],
                      opset_version=17, dynamo=False)
    onnx.save(float16.convert_float_to_float16(onnx.load(fp32), keep_io_types=True), os.path.join(args.out, f"{name}{size}_fp16.onnx"))
    fp16_weights(fp32, os.path.join(args.out, f"{name}{size}_fp16w.onnx"))
    quantize_dynamic(fp32, os.path.join(args.out, f"{name}{size}_int8dyn.onnx"), weight_type=QuantType.QUInt8)
    pre = os.path.join(args.out, f"{name}{size}_pre.onnx")
    quant_pre_process(fp32, pre)
    calib = [paths[i] for i in rng.choice(len(paths), args.calib, replace=False)]
    quantize_static(pre, os.path.join(args.out, f"{name}{size}_int8qdq.onnx"), Reader(calib, size), quant_format=QuantFormat.QDQ,
                    activation_type=QuantType.QUInt8, weight_type=QuantType.QInt8, per_channel=True)
    os.remove(pre)
    for v in ("fp32", "fp16", "fp16w", "int8dyn", "int8qdq"):
        p = os.path.join(args.out, f"{name}{size}_{v}.onnx")
        print(f"{name}_{v}: {os.path.getsize(p) / 1e6:.2f} MB", flush=True)
