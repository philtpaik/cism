"""Generate PWA icons for the CISM study app. Run once with: python scripts/gen_icons.py"""
from PIL import Image, ImageDraw
import os

OUT = os.path.join(os.path.dirname(__file__), "..", "icons")
os.makedirs(OUT, exist_ok=True)

BG = (15, 23, 42)      # slate-900
ACCENT = (245, 158, 11)  # amber-500
ACCENT_DARK = (180, 115, 5)


def draw_shield(size, padding_ratio=0.14, maskable=False):
    """Draw a shield-with-keyhole mark on a rounded/square background."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # Background
    if maskable:
        # Maskable icons must fill edge-to-edge (safe zone handled by padding below)
        d.rectangle([0, 0, size, size], fill=BG)
    else:
        radius = int(size * 0.22)
        d.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=BG)

    pad = int(size * padding_ratio)
    x0, y0, x1, y1 = pad, pad, size - pad, size - pad
    w = x1 - x0
    h = y1 - y0

    # Shield outline (polygon): top edge, curved sides, point at bottom
    top = y0
    mid = y0 + h * 0.55
    bottom = y1
    left = x0
    right = x1
    cx = x0 + w / 2

    shield_pts = [
        (left, top),
        (right, top),
        (right, mid),
        (cx, bottom),
        (left, mid),
    ]
    d.polygon(shield_pts, fill=ACCENT)

    # subtle inner shade band
    inner_pts = [
        (left + w * 0.10, top + h * 0.06),
        (right - w * 0.10, top + h * 0.06),
        (right - w * 0.10, mid - h * 0.02),
        (cx, bottom - h * 0.10),
        (left + w * 0.10, mid - h * 0.02),
    ]
    d.polygon(inner_pts, fill=ACCENT_DARK)

    # Keyhole (lock) cutout in the middle, drawn in BG color to punch through
    kh_cx = cx
    kh_cy = y0 + h * 0.40
    r = w * 0.14
    d.ellipse([kh_cx - r, kh_cy - r, kh_cx + r, kh_cy + r], fill=BG)
    tri_w = r * 0.9
    tri_top = kh_cy + r * 0.35
    tri_bottom = kh_cy + h * 0.26
    d.polygon(
        [
            (kh_cx - tri_w * 0.35, tri_top),
            (kh_cx + tri_w * 0.35, tri_top),
            (kh_cx, tri_bottom),
        ],
        fill=BG,
    )

    return img


for size, name, maskable in [
    (192, "icon-192.png", False),
    (512, "icon-512.png", False),
    (192, "icon-192-maskable.png", True),
    (512, "icon-512-maskable.png", True),
    (180, "apple-touch-icon.png", False),
    (32, "favicon-32.png", False),
    (16, "favicon-16.png", False),
]:
    pad_ratio = 0.22 if maskable else 0.14
    img = draw_shield(size, padding_ratio=pad_ratio, maskable=maskable)
    img.save(os.path.join(OUT, name))
    print("wrote", name)

print("done")
