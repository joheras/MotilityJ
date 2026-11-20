"""Export the original Deep-Motility TorchScript models to ONNX, plus FP16 and INT8 variants (for the size table).

usage: python3 export_teacher.py MODELS_DIR OUT_DIR [--seg-size 1002] [--cls-size 512]
needs: onnx, onnxruntime, onnxconverter-common
"""
import argparse
import os
import sys
import torch
import onnx
from onnxconverter_common import float16
from onnxruntime.quantization import quantize_dynamic, QuantType

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from teacher_eager import load_seg_teacher



ap = argparse.ArgumentParser()
ap.add_argument("models"); ap.add_argument("out")
ap.add_argument("--seg-size", type=int, default=1002)
ap.add_argument("--cls-size", type=int, default=512)
args = ap.parse_args()
os.makedirs(args.out, exist_ok=True)

for src, name, size in (("HRNet Seg.pth", "teacher_seg", args.seg_size), ("resnet50Motility.pth", "teacher_cls", args.cls_size)):
    if name == "teacher_seg":
        m = load_seg_teacher(os.path.join(args.models, src))  # eager rebuild, see teacher_eager.py
    else:
        m = torch.jit.load(os.path.join(args.models, src), map_location="cpu").eval()
    fp32 = os.path.join(args.out, f"{name}_fp32.onnx")
    torch.onnx.export(m, torch.zeros(1, 3, size, size), fp32, input_names=["input"], output_names=["logits"],
                      opset_version=17, dynamo=False)
    model = onnx.load(fp32)
    onnx.save(float16.convert_float_to_float16(model, keep_io_types=True), os.path.join(args.out, f"{name}_fp16.onnx"))
    quantize_dynamic(fp32, os.path.join(args.out, f"{name}_int8.onnx"), weight_type=QuantType.QUInt8)
    for v in ("fp32", "fp16", "int8"):
        p = os.path.join(args.out, f"{name}_{v}.onnx")
        print(f"{name}_{v}: {os.path.getsize(p) / 1e6:.1f} MB")
