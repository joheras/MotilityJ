"""Student networks distilled from the Deep-Motility teachers (see train_seg.py / train_cls.py).

Both take a 1×3×S×S ImageNet-normalised image (grey replicated to 3 channels, like the teachers).
SegStudent -> 1×1×S×S growth logits.   ClsStudent -> 1×2 logits (0 = complete, 1 = incomplete).
"""
import torch
import torch.nn as nn
import torch.nn.functional as F
from torchvision.models import mobilenet_v3_large, MobileNet_V3_Large_Weights


def _encoder(pretrained):
    return mobilenet_v3_large(weights=MobileNet_V3_Large_Weights.IMAGENET1K_V1 if pretrained else None).features


class _Up(nn.Module):
    def __init__(self, cin, cskip, cout):
        super().__init__()
        self.conv = nn.Sequential(
            nn.Conv2d(cin + cskip, cout, 3, padding=1, bias=False), nn.BatchNorm2d(cout), nn.ReLU(inplace=True),
            nn.Conv2d(cout, cout, 3, padding=1, bias=False), nn.BatchNorm2d(cout), nn.ReLU(inplace=True))

    def forward(self, x, skip):
        x = F.interpolate(x, size=skip.shape[2:], mode="bilinear", align_corners=False)
        return self.conv(torch.cat([x, skip], 1))


class SegStudent(nn.Module):
    """U-Net decoder on a MobileNetV3-Large encoder. Skips at strides 2, 4, 8, 16; bottleneck at stride 32."""
    TAPS = (1, 3, 6, 12, 16)  # indices of mobilenet_v3_large.features whose outputs are used

    def __init__(self, pretrained=True, width=(16, 24, 40, 112, 960), dec=(128, 64, 48, 32)):
        super().__init__()
        self.enc = _encoder(pretrained)
        self.up4 = _Up(width[4], width[3], dec[0])
        self.up3 = _Up(dec[0], width[2], dec[1])
        self.up2 = _Up(dec[1], width[1], dec[2])
        self.up1 = _Up(dec[2], width[0], dec[3])
        self.out = nn.Conv2d(dec[3], 1, 1)

    def forward(self, x):
        feats = []
        y = x
        for i, layer in enumerate(self.enc):
            y = layer(y)
            if i in self.TAPS:
                feats.append(y)
        s2, s4, s8, s16, s32 = feats
        y = self.up4(s32, s16)
        y = self.up3(y, s8)
        y = self.up2(y, s4)
        y = self.up1(y, s2)
        return F.interpolate(self.out(y), size=x.shape[2:], mode="bilinear", align_corners=False)


class ClsStudent(nn.Module):
    def __init__(self, pretrained=True):
        super().__init__()
        self.enc = _encoder(pretrained)
        self.head = nn.Sequential(nn.Linear(960, 256), nn.Hardswish(), nn.Dropout(0.2), nn.Linear(256, 2))

    def forward(self, x):
        return self.head(self.enc(x).mean((2, 3)))
