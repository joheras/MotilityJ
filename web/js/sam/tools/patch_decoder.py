#!/usr/bin/env python3
"""Restores box prompts in the SlimSAM-77 ONNX decoder of Xenova/slimsam-77-uniform.

That export was traced from transformers' SamPromptEncoder, which only adds the type embeddings of
labels 0 (negative) and 1 (positive): the box-corner embeddings (labels 2 = top-left, 3 = bottom-right)
were pruned, so a box given as two labelled points is treated as two untyped points and fails.
This script fetches those two 256-float vectors from the original weights (nielsr/slimsam-77-uniform,
HTTP range requests, ~2 KB) and inserts  pe = where(label == k, pe + point_embed[k], pe)  for k = 2, 3
right after the existing label == 1 branch. Nothing else in the graph changes.

    pip install onnx numpy
    python3 patch_decoder.py prompt_encoder_mask_decoder_quantized.onnx sam_decoder_box_q8.onnx
"""
import json, struct, sys, urllib.request
import numpy as np
import onnx
from onnx import helper, numpy_helper

WEIGHTS = "https://huggingface.co/nielsr/slimsam-77-uniform/resolve/72a5ae6ca4d1da579a001f6f008b6fb949282c10/model.safetensors"


def fetch(start, end):
    req = urllib.request.Request(WEIGHTS, headers={"Range": f"bytes={start}-{end - 1}"})
    return urllib.request.urlopen(req).read()


def corner_embeddings():
    n = struct.unpack("<Q", fetch(0, 8))[0]
    header = json.loads(fetch(8, 8 + n))
    out = []
    for k in (2, 3):
        a, b = header[f"prompt_encoder.point_embed.{k}.weight"]["data_offsets"]
        out.append(np.frombuffer(fetch(8 + n + a, 8 + n + b), np.float32).reshape(1, 256))
    return out


def main(src, dst):
    m = onnx.load(src)
    g = m.graph
    last = "/prompt_encoder/Where_3_output_0"   # embeddings after the label == 1 branch
    labels = "/prompt_encoder/Concat_3_output_0"  # float labels incl. the padding point (-1)
    assert any(last in n.output for n in g.node) and any(labels in n.output for n in g.node), "unexpected graph"
    users = [n for n in g.node if last in n.input]
    cur, nodes = last, []
    for k, emb in zip((2, 3), corner_embeddings()):
        p = f"/prompt_encoder/box{k}"
        g.initializer.extend([numpy_helper.from_array(emb, f"{p}_embed"),
                              numpy_helper.from_array(np.array(float(k), np.float32), f"{p}_k"),
                              numpy_helper.from_array(np.array([-1], np.int64), f"{p}_axis")])
        nodes += [helper.make_node("Equal", [labels, f"{p}_k"], [f"{p}_eq"]),
                  helper.make_node("Unsqueeze", [f"{p}_eq", f"{p}_axis"], [f"{p}_mask"]),
                  helper.make_node("Add", [cur, f"{p}_embed"], [f"{p}_add"]),
                  helper.make_node("Where", [f"{p}_mask", f"{p}_add", cur], [f"{p}_out"])]
        cur = f"{p}_out"
    for n in users:
        n.input[:] = [cur if i == last else i for i in n.input]
    idx = max(i for i, n in enumerate(g.node) if last in n.output) + 1
    for j, n in enumerate(nodes):
        g.node.insert(idx + j, n)
    onnx.checker.check_model(m)
    onnx.save(m, dst)
    print(f"wrote {dst}")


if __name__ == "__main__":
    main(*sys.argv[1:3])
