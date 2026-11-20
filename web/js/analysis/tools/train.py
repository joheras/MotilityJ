"""Reproduce web/js/analysis/models.json (Python reference of core.js).

Usage:  python3 train.py /path/to/Motilidad [out_models.json]
Needs numpy, scipy, opencv-python, scikit-learn. Takes ~15-20 min on 8 cores (plate search is the slow part).
Prints segmentation metrics on Segmentation/test and classification metrics on Clasificacion/valid.
"""
import glob, json, os, sys
from multiprocessing import Pool
import cv2, numpy as np
from scipy import ndimage as ndi
from sklearn.neural_network import MLPClassifier
from sklearn.ensemble import HistGradientBoostingClassifier

WORK, R = 256, 128
yy, xx = np.mgrid[0:R, 0:R]
DD = np.hypot(xx - R / 2 + 0.5, yy - R / 2 + 0.5) / (R / 2)
DISC, ANN, CEN = DD < 0.92, (DD > 0.75) & (DD < 0.9), DD < 0.05

# ---- plate ----
NA = 128
ang = np.linspace(0, 2 * np.pi, NA, endpoint=False); CA, SA = np.cos(ang), np.sin(ang)
def _grad(g): return cv2.Sobel(g, cv2.CV_32F, 1, 0), cv2.Sobel(g, cv2.CV_32F, 0, 1)
def _score(gx, gy, cx, cy, r):
    H, W = gx.shape; xi = np.round(cx + r * CA).astype(int); yi = np.round(cy + r * SA).astype(int)
    v = (xi >= 0) & (xi < W) & (yi >= 0) & (yi < H); xi = np.clip(xi, 0, W - 1); yi = np.clip(yi, 0, H - 1)
    return (np.abs(gx[yi, xi] * CA + gy[yi, xi] * SA) * v).sum() / NA
def find_plate(g):
    H, W = g.shape; s = min(H, W)
    g2 = cv2.resize(g, (W // 2, H // 2), interpolation=cv2.INTER_AREA); gx, gy = _grad(g2); best = (-1, None)
    for cx in np.arange(W / 4 - 0.05 * s, W / 4 + 0.05 * s + .01, 1):
        for cy in np.arange(H / 4 - 0.05 * s, H / 4 + 0.05 * s + .01, 1):
            for r in np.arange(0.19 * s, 0.265 * s, 1):
                v = _score(gx, gy, cx, cy, r)
                if v > best[0]: best = (v, (cx * 2, cy * 2, r * 2))
    gx, gy = _grad(g); c0 = best[1]; best = (-1, None)
    for cx in np.arange(c0[0] - 2, c0[0] + 2.01, 1):
        for cy in np.arange(c0[1] - 2, c0[1] + 2.01, 1):
            for r in np.arange(c0[2] - 2, c0[2] + 2.01, 1):
                v = _score(gx, gy, cx, cy, r)
                if v > best[0]: best = (v, (cx, cy, r))
    return best[1]

def load_work(path):
    im = cv2.imread(path, 0); H, W = im.shape; sc = WORK / max(H, W)
    return cv2.resize(im, (round(W * sc), round(H * sc)), interpolation=cv2.INTER_AREA).astype(np.float32)
def crop_matrix(pl):
    cx, cy, r = pl; s = R / (2 * r); return np.float32([[s, 0, R / 2 - s * cx], [0, s, R / 2 - s * cy]])
def crop(g, M): return cv2.warpAffine(g, M, (R, R), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)

# ---- per-pixel features ----
def stats(c):
    bg = np.median(c[ANN]); sc = max(np.percentile(c[DISC], 95) - np.percentile(c[DISC], 5), 10)
    return bg, sc, np.median(c[CEN])
def pixel_features(c):
    bg, sc, cen = stats(c); F = []
    for s in [1, 2, 4, 8, 16]:
        b = cv2.GaussianBlur(c, (0, 0), s); F += [(b - bg) / sc, np.abs(b - bg) / sc, (b - cen) / sc]
    for s in [2, 4, 8]:
        m1 = cv2.GaussianBlur(c, (0, 0), s); m2 = cv2.GaussianBlur(c * c, (0, 0), s)
        F.append(np.sqrt(np.maximum(m2 - m1 * m1, 0)) / sc)
    for s in [1, 2, 4]:
        b = cv2.GaussianBlur(c, (0, 0), s); F.append(np.hypot(cv2.Sobel(b, cv2.CV_32F, 1, 0), cv2.Sobel(b, cv2.CV_32F, 0, 1)) / sc)
    F.append(DD)
    for v in [(cen - bg) / sc, (np.median(c[DISC]) - bg) / sc, bg / 255, sc / 255, np.std(c[ANN]) / sc]:
        F.append(np.full_like(c, v))
    return np.stack(F, -1).reshape(-1, len(F))

def select_growth(p, thr=0.5):
    m = (p.reshape(R, R) > thr) & DISC
    lab, n = ndi.label(m)
    if n == 0: return m
    best, bA = None, 0
    for i, sl in enumerate(ndi.find_objects(lab), 1):
        full = np.zeros_like(m); full[sl] = ndi.binary_fill_holes(lab[sl] == i)
        if (full & (DD < 0.1)).any() and full.sum() > bA: best, bA = full, full.sum()
    if best is None:
        idx = ndi.distance_transform_edt(lab == 0, return_indices=True)[1]
        best = ndi.binary_fill_holes(lab == lab[idx[0][64, 64], idx[1][64, 64]])
    return best

# ---- plate-level features ----
BINS = [0, 0.2, 0.4, 0.6, 0.75, 0.9]
TH = np.arctan2(yy - R / 2 + 0.5, xx - R / 2 + 0.5)
def plate_features(c, p, m):
    bg, sc, _ = stats(c)
    gm = np.hypot(cv2.Sobel(c, cv2.CV_32F, 1, 0), cv2.Sobel(c, cv2.CV_32F, 0, 1)) / sc
    f = [m[DISC].mean(), (p[DISC] > 0.5).mean(), p[DISC].mean(), sc / 255, bg / 255]
    for a, b in zip(BINS[:-1], BINS[1:]):
        z = (DD >= a) & (DD < b); f += [p[z].mean(), m[z].mean(), np.median(c[z] - bg) / sc, np.std(c[z]) / sc, gm[z].mean()]
    z = (DD > 0.8) & (DD < 0.9); sec = ((TH[z] + np.pi) / (2 * np.pi) * 16).astype(int) % 16
    cov = np.bincount(sec, weights=m[z], minlength=16) / np.maximum(np.bincount(sec, minlength=16), 1)
    return np.array(f + [(cov > 0.5).mean(), cov.min()], np.float32)

# ---- data ----
def seg_item(args):
    img, lbl = args; g = load_work(img); M = crop_matrix(find_plate(g))
    mfull = cv2.imread(lbl, 0) > 127
    mw = cv2.resize(mfull.astype(np.float32), (g.shape[1], g.shape[0]), interpolation=cv2.INTER_AREA) > 0.5
    return g, M, mw
def cls_item(path):
    g = load_work(path); return crop(g, crop_matrix(find_plate(g)))

def main():
    D = sys.argv[1].rstrip('/') + '/'; out = sys.argv[2] if len(sys.argv) > 2 else 'models.json'
    pairs = lambda split: [(p.replace('/Labels/', '/Images/')[:-4] + '.jpg', p) for p in sorted(glob.glob(D + f'Segmentation/dataset/Labels/{split}/*.png'))]
    with Pool() as P:
        seg_tr, seg_te = P.map(seg_item, pairs('train')), P.map(seg_item, pairs('test'))
        cls = {s: [(P.map(cls_item, sorted(glob.glob(D + f'Clasificacion/dataset/{s}/{k}/*.jpg'))), y) for k, y in [('Complete', 1), ('Incomplete', 0)]] for s in ['train', 'valid']}
    # segmentation MLP: 3000 random disc pixels per labelled training image
    rng = np.random.default_rng(0); X, Y = [], []
    for g, M, mw in seg_tr:
        F = pixel_features(crop(g, M)); mc = cv2.warpAffine(mw.astype(np.float32), M, (R, R)) > 0.5
        idx = rng.choice(np.flatnonzero(DISC.ravel()), 3000, replace=False); X.append(F[idx]); Y.append(mc.ravel()[idx])
    seg = MLPClassifier((32, 16), max_iter=100, random_state=0, early_stopping=True).fit(np.concatenate(X).astype(np.float32), np.concatenate(Y))
    prob = lambda c: seg.predict_proba(pixel_features(c))[:, 1].reshape(R, R)
    ious = []
    for g, M, mw in seg_te:
        pm = cv2.warpAffine(select_growth(prob(crop(g, M))).astype(np.float32), cv2.invertAffineTransform(M), (g.shape[1], g.shape[0])) > 0.5
        ious.append((pm & mw).sum() / max((pm | mw).sum(), 1))
    print('segmentation test mIoU %.3f' % np.mean(ious))
    def feats(crops):
        out = []
        for c in crops: p = prob(c); out.append(plate_features(c, p, select_growth(p)))
        return np.stack(out)
    Xc = {s: np.concatenate([feats(cs) for cs, _ in cls[s]]) for s in cls}
    yc = {s: np.concatenate([np.full(len(cs), y) for cs, y in cls[s]]) for s in cls}
    gb = HistGradientBoostingClassifier(max_iter=200, max_leaf_nodes=15, early_stopping=False, random_state=0).fit(Xc['train'], yc['train'])
    print('classification valid accuracy %.3f' % (gb.predict(Xc['valid']) == yc['valid']).mean())
    trees = [dict(f=t[0].nodes['feature_idx'].tolist(), t=t[0].nodes['num_threshold'].tolist(), l=t[0].nodes['left'].tolist(),
                  r=t[0].nodes['right'].tolist(), leaf=t[0].nodes['is_leaf'].astype(int).tolist(), v=[round(float(v), 6) for v in t[0].nodes['value']])
             for t in gb._predictors]
    r7 = lambda a: np.round(np.asarray(a, np.float64), 7).tolist()
    json.dump(dict(seg=dict(coefs=[r7(c) for c in seg.coefs_], intercepts=[r7(c) for c in seg.intercepts_], threshold=0.5),
                   cls=dict(kind='gbdt', base=float(np.ravel(gb._baseline_prediction)[0]), trees=trees)), open(out, 'w'), separators=(',', ':'))

if __name__ == '__main__':
    main()
