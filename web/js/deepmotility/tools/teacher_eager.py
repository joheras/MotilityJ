"""Rebuild the Deep-Motility HRNet segmentation model in eager PyTorch so that it can be exported to ONNX.

"HRNet Seg.pth" is a TorchScript file saved with PyTorch 1.7 (SemTorch's HRNet-W30 + 1×1 head, 2 classes).
Its interpolate calls use an operator overload that current ONNX exporters cannot freeze, so this file re-implements
the standard HRNet (Wang et al., 2019) with the same module names and copies the scripted weights in.
load_seg_teacher() checks that the eager model reproduces the scripted output.
"""
import torch
import torch.nn as nn
import torch.nn.functional as F


def _bn(c):
    return nn.BatchNorm2d(c, momentum=0.01)


class BasicBlock(nn.Module):
    def __init__(self, c):
        super().__init__()
        self.conv1 = nn.Conv2d(c, c, 3, 1, 1, bias=False); self.bn1 = _bn(c)
        self.conv2 = nn.Conv2d(c, c, 3, 1, 1, bias=False); self.bn2 = _bn(c)
        self.relu = nn.ReLU(inplace=True)

    def forward(self, x):
        y = self.relu(self.bn1(self.conv1(x)))
        return self.relu(self.bn2(self.conv2(y)) + x)


class Bottleneck(nn.Module):
    def __init__(self, cin, c):
        super().__init__()
        self.conv1 = nn.Conv2d(cin, c, 1, bias=False); self.bn1 = _bn(c)
        self.conv2 = nn.Conv2d(c, c, 3, 1, 1, bias=False); self.bn2 = _bn(c)
        self.conv3 = nn.Conv2d(c, c * 4, 1, bias=False); self.bn3 = _bn(c * 4)
        self.relu = nn.ReLU(inplace=True)
        self.downsample = nn.Sequential(nn.Conv2d(cin, c * 4, 1, bias=False), _bn(c * 4)) if cin != c * 4 else None

    def forward(self, x):
        y = self.relu(self.bn1(self.conv1(x)))
        y = self.relu(self.bn2(self.conv2(y)))
        y = self.bn3(self.conv3(y))
        return self.relu(y + (self.downsample(x) if self.downsample is not None else x))


class HRModule(nn.Module):
    def __init__(self, chans, nblocks=4):
        super().__init__()
        n = len(chans)
        self.branches = nn.ModuleList([nn.Sequential(*[BasicBlock(c) for _ in range(nblocks)]) for c in chans])
        fuse = []
        for i in range(n):
            row = []
            for j in range(n):
                if j > i:
                    row.append(nn.Sequential(nn.Conv2d(chans[j], chans[i], 1, bias=False), _bn(chans[i])))
                elif j == i:
                    row.append(None)
                else:
                    steps = []
                    for k in range(i - j):
                        last = k == i - j - 1
                        cout = chans[i] if last else chans[j]
                        layers = [nn.Conv2d(chans[j], cout, 3, 2, 1, bias=False), _bn(cout)]
                        if not last:
                            layers.append(nn.ReLU(inplace=True))
                        steps.append(nn.Sequential(*layers))
                    row.append(nn.Sequential(*steps))
            fuse.append(nn.ModuleList(row))
        self.fuse_layers = nn.ModuleList(fuse)
        self.relu = nn.ReLU(inplace=True)

    def forward(self, xs):
        xs = [b(x) for b, x in zip(self.branches, xs)]
        out = []
        for i, row in enumerate(self.fuse_layers):
            y = None
            for j, f in enumerate(row):
                if j == i:
                    z = xs[j]
                elif j > i:
                    z = F.interpolate(f(xs[j]), size=xs[i].shape[2:], mode="bilinear", align_corners=False)
                else:
                    z = f(xs[j])
                y = z if y is None else y + z
            out.append(self.relu(y))
        return out


def _transition(cin, cout):
    return nn.Sequential(nn.Conv2d(cin, cout, 3, 1, 1, bias=False), _bn(cout), nn.ReLU(inplace=True))


def _down(cin, cout):
    return nn.Sequential(nn.Sequential(nn.Conv2d(cin, cout, 3, 2, 1, bias=False), _bn(cout), nn.ReLU(inplace=True)))


class HighResolutionNet(nn.Module):
    def __init__(self, w=30):
        super().__init__()
        c = [w, 2 * w, 4 * w, 8 * w]
        self.conv1 = nn.Conv2d(3, 64, 3, 2, 1, bias=False); self.bn1 = _bn(64)
        self.conv2 = nn.Conv2d(64, 64, 3, 2, 1, bias=False); self.bn2 = _bn(64)
        self.relu = nn.ReLU(inplace=True)
        self.layer1 = nn.Sequential(Bottleneck(64, 64), *[Bottleneck(256, 64) for _ in range(3)])
        self.transition1 = nn.ModuleList([_transition(256, c[0]), _down(256, c[1])])
        self.stage2 = nn.ModuleList([HRModule(c[:2])])
        self.transition2 = nn.ModuleList([None, None, _down(c[1], c[2])])
        self.stage3 = nn.ModuleList([HRModule(c[:3]) for _ in range(4)])
        self.transition3 = nn.ModuleList([None, None, None, _down(c[2], c[3])])
        self.stage4 = nn.ModuleList([HRModule(c) for _ in range(3)])
        self.last_inp_channels = sum(c)

    def forward(self, x):
        x = self.relu(self.bn2(self.conv2(self.relu(self.bn1(self.conv1(x))))))
        x = self.layer1(x)
        xs = [self.transition1[0](x), self.transition1[1](x)]
        for m in self.stage2:
            xs = m(xs)
        xs = xs + [self.transition2[2](xs[-1])]
        for m in self.stage3:
            xs = m(xs)
        xs = xs + [self.transition3[3](xs[-1])]
        for m in self.stage4:
            xs = m(xs)
        size = xs[0].shape[2:]
        return torch.cat([xs[0]] + [F.interpolate(t, size=size, mode="bilinear", align_corners=False) for t in xs[1:]], 1)


class HRNetSeg(nn.Module):
    def __init__(self, w=30, nclass=2):
        super().__init__()
        self.backbone = HighResolutionNet(w)
        c = self.backbone.last_inp_channels
        self.head = nn.Sequential(nn.Conv2d(c, c, 1), _bn(c), nn.ReLU(inplace=True), nn.Conv2d(c, nclass, 1))

    def forward(self, x):
        y = self.head(self.backbone(x))
        return F.interpolate(y, size=x.shape[2:], mode="bilinear", align_corners=False)


def load_seg_teacher(pth):
    scripted = torch.jit.load(pth, map_location="cpu").eval()
    sd = scripted.state_dict()
    m = HRNetSeg(w=sd["backbone.transition1.0.0.weight"].shape[0]).eval()
    m.load_state_dict(sd, strict=True)
    x = torch.randn(1, 3, 256, 256)
    with torch.no_grad():
        d = (m(x) - scripted(x)).abs().max().item()
    assert d < 1e-3, f"eager/scripted mismatch {d}"
    return m
