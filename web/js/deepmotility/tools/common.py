"""Shared helpers for the Deep-Motility export / distillation / evaluation scripts.

The data layout is the MotilityJ datasets folder (``Motilidad/``):
  Segmentation/dataset/Images/{train,test}/*.jpg  +  Labels/{train,test}/*.png (0/255)
  Clasificacion/dataset/{train,valid}/{Complete,Incomplete}/*.jpg
"""
import os
import numpy as np
from PIL import Image
from scipy import ndimage

MEAN = np.array([0.485, 0.456, 0.406], np.float32)
STD = np.array([0.229, 0.224, 0.225], np.float32)


def seg_pairs(root, split):
    img_dir = os.path.join(root, "Segmentation/dataset/Images", split)
    lab_dir = os.path.join(root, "Segmentation/dataset/Labels", split)
    out = []
    for f in sorted(os.listdir(lab_dir)):
        stem = os.path.splitext(f)[0]
        for ext in (".jpg", ".png", ".tif", ".jpeg"):
            p = os.path.join(img_dir, stem + ext)
            if os.path.exists(p):
                out.append((p, os.path.join(lab_dir, f)))
                break
    return out


def cls_items(root, split):
    out = []
    for k, name in enumerate(["Complete", "Incomplete"]):  # Deep-Motility: class 0 = complete
        d = os.path.join(root, "Clasificacion/dataset", split, name)
        out += [(os.path.join(d, f), k) for f in sorted(os.listdir(d))]
    return out


def load_rgb(path):
    """Same as Deep-Motility: grey images are replicated to 3 channels."""
    return Image.open(path).convert("L").convert("RGB")


def to_tensor_np(img, size):
    """PIL bilinear (antialiased) resize to size×size, ToTensor and ImageNet normalisation → 1×3×S×S."""
    a = np.asarray(img.resize((size, size), Image.BILINEAR), np.float32) / 255.0
    a = (a - MEAN) / STD
    return a.transpose(2, 0, 1)[None].copy()


def largest_component(mask):
    """ImageJ "Analyze Particles" + keepBiggestROI: biggest 8-connected particle, holes filled."""
    lab, n = ndimage.label(mask, structure=np.ones((3, 3)))
    if n == 0:
        return mask.astype(bool)
    sizes = ndimage.sum(mask, lab, range(1, n + 1))
    return ndimage.binary_fill_holes(lab == (1 + int(np.argmax(sizes))))


def seg_metrics(pred, gt):
    p, g = pred.astype(bool), gt.astype(bool)
    inter, union = (p & g).sum(), (p | g).sum()
    iou = 1.0 if union == 0 else inter / union
    dice = 1.0 if p.sum() + g.sum() == 0 else 2 * inter / (p.sum() + g.sum())
    area_err = abs(int(p.sum()) - int(g.sum())) / max(1, int(g.sum()))
    return iou, dice, area_err, int(inter), int(p.sum()), int(g.sum())


def summarize_seg(rows):
    r = np.array(rows)
    out = dict(n=len(r), mIoU=float(r[:, 0].mean()), medIoU=float(np.median(r[:, 0])),
               Dice=float(r[:, 1].mean()), medAreaErr=float(np.median(r[:, 2])), meanAreaErr=float(r[:, 2].mean()))
    if r.shape[1] >= 6:  # Dice of all test pixels pooled (one way papers report it)
        out["pooledDice"] = float(2 * r[:, 3].sum() / (r[:, 4].sum() + r[:, 5].sum()))
    return out


def summarize_cls(y, p):
    y, p = np.asarray(y), np.asarray(p)
    acc = float((y == p).mean())
    f1 = []
    for k in (0, 1):
        tp = ((p == k) & (y == k)).sum(); fp = ((p == k) & (y != k)).sum(); fn = ((p != k) & (y == k)).sum()
        f1.append(float(2 * tp / max(1, 2 * tp + fp + fn)))
    return dict(n=len(y), acc=acc, F1_complete=f1[0], F1_incomplete=f1[1], macroF1=(f1[0] + f1[1]) / 2)


def mask_to_full(prob_or_mask, w, h):
    """Upsample a low-res map (float in [0,1] or bool) to the label size and threshold at 0.5."""
    im = Image.fromarray((prob_or_mask.astype(np.float32) * 255).astype(np.uint8))
    return np.asarray(im.resize((w, h), Image.BILINEAR)) >= 128
