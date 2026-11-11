"""Generate Mangalam app icon + splash logo PNGs."""
from PIL import Image, ImageDraw, ImageFont
import math

MAROON = (183, 28, 28, 255)
GOLD = (201, 162, 39, 255)
CREAM = (252, 245, 237, 255)
INK = (33, 28, 28, 255)

def rounded_bg(size, radius, color):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=color)
    return img

def draw_heart(d, cx, cy, size, color):
    """Draw a heart shape centered at (cx, cy)."""
    s = size
    # Two circles for the top lobes
    r = s * 0.28
    d.ellipse([cx - r, cy - r * 0.9, cx, cy + r * 0.1], fill=color)
    d.ellipse([cx, cy - r * 0.9, cx + r, cy + r * 0.1], fill=color)
    # Triangle for the bottom
    d.polygon([
        (cx - r * 0.95, cy - r * 0.05),
        (cx + r * 0.95, cy - r * 0.05),
        (cx, cy + s * 0.55),
    ], fill=color)

def draw_mandap(d, cx, cy, w, h, color):
    """Draw a simple mandap/temple silhouette."""
    # Arch base
    bw = w
    bh = h * 0.55
    by = cy + h * 0.15
    d.rounded_rectangle([cx - bw / 2, by, cx + bw / 2, by + bh], radius=int(bw * 0.12), fill=color)
    # Dome on top
    dw = w * 0.6
    dh = h * 0.5
    dy = cy - h * 0.05
    d.pieslice([cx - dw / 2, dy, cx + dw / 2, dy + dh], 180, 360, fill=color)
    # Finial
    d.line([cx, dy - 2, cx, dy - h * 0.18], fill=color, width=max(2, int(w * 0.04)))
    d.ellipse([cx - w * 0.05, dy - h * 0.22, cx + w * 0.05, dy - h * 0.14], fill=color)

def try_font(size, bold=False):
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
        "/System/Library/Fonts/SFNS.ttf",
    ]
    for c in candidates:
        try:
            return ImageFont.truetype(c, size)
        except Exception:
            continue
    return ImageFont.load_default()

# ─── App icon (1024x1024) ────────────────────────────────────────────────
def make_icon():
    size = 1024
    img = rounded_bg(size, int(size * 0.22), MAROON)
    d = ImageDraw.Draw(img)
    # Gold ring (border)
    margin = int(size * 0.06)
    d.rounded_rectangle(
        [margin, margin, size - margin, size - margin],
        radius=int(size * 0.18),
        outline=GOLD,
        width=int(size * 0.018),
    )
    # Heart in gold
    draw_heart(d, size / 2, size * 0.46, size * 0.5, GOLD)
    # "Mangalam" text below
    font = try_font(int(size * 0.085), bold=True)
    text = "Mangalam"
    bbox = d.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    d.text((size / 2 - tw / 2, size * 0.78 - th / 2), text, font=font, fill=CREAM, anchor="mm")
    img.save("assets/icon.png")
    print("wrote assets/icon.png")

# ─── Splash logo (transparent, ~600x600) ──────────────────────────────────
def make_splash_logo():
    size = 600
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Gold heart
    draw_heart(d, size / 2, size * 0.42, size * 0.55, GOLD)
    # "Mangalam" text below in cream
    font = try_font(int(size * 0.13), bold=True)
    text = "Mangalam"
    bbox = d.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    d.text((size / 2 - tw / 2, size * 0.82), text, font=font, fill=CREAM, anchor="mm")
    # Tagline
    font2 = try_font(int(size * 0.05))
    tag = "Find your perfect match"
    bbox2 = d.textbbox((0, 0), tag, font=font2)
    tw2 = bbox2[2] - bbox2[0]
    d.text((size / 2 - tw2 / 2, size * 0.92), tag, font=font2, fill=(220, 200, 160, 255), anchor="mm")
    img.save("assets/splash_logo.png")
    print("wrote assets/splash_logo.png")

if __name__ == "__main__":
    import os
    os.makedirs("assets", exist_ok=True)
    make_icon()
    make_splash_logo()
