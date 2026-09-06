#!/usr/bin/env python3
"""Generate text-overlay PNGs for each scene of the SemantiNote reel."""

from PIL import Image, ImageDraw, ImageFont
import os, sys

W, H = 1080, 1920
BG = (13, 13, 26, 0)  # transparent
WHITE = (255, 255, 255, 255)
MUTED = (187, 187, 187, 255)
ACCENT = (187, 170, 255, 255)
PURPLE = (124, 108, 240, 255)
DIM = (136, 136, 136, 255)
LIGHT_BLUE = (221, 221, 255, 255)
DARK_BG = (13, 13, 26, 255)

OUT = sys.argv[1] if len(sys.argv) > 1 else "/tmp"

def get_font(size, bold=False):
    """Try to load Helvetica Neue, fall back to system fonts."""
    candidates = [
        "/System/Library/Fonts/HelveticaNeue.ttc",
        "/System/Library/Fonts/Helvetica.ttc",
        "/System/Library/Fonts/SFNSText.ttf",
        "/System/Library/Fonts/SFNS.ttf",
    ]
    for path in candidates:
        if os.path.exists(path):
            try:
                idx = 1 if bold and path.endswith(".ttc") else 0
                return ImageFont.truetype(path, size, index=idx)
            except Exception:
                try:
                    return ImageFont.truetype(path, size)
                except Exception:
                    continue
    return ImageFont.load_default()

def center_text(draw, text, y, font, fill):
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    x = (W - tw) // 2
    draw.text((x, y), text, font=font, fill=fill)

def make_overlay(filename, lines):
    """Create a transparent PNG overlay with centered text lines.
    lines: list of (text, y, size, color, bold)
    """
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    for text, y, size, color, bold in lines:
        font = get_font(size, bold)
        center_text(draw, text, y, font, color)
    img.save(os.path.join(OUT, filename))

def make_full_frame(filename, lines):
    """Create a full opaque dark frame with text (for scenes without video bg)."""
    img = Image.new("RGBA", (W, H), DARK_BG)
    draw = ImageDraw.Draw(img)
    for text, y, size, color, bold in lines:
        font = get_font(size, bold)
        center_text(draw, text, y, font, color)
    img.save(os.path.join(OUT, filename))

def make_caption_overlay(filename, title, caption):
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.rounded_rectangle((44, 1660, 1036, 1850), 20, fill=(13, 13, 26, 235))
    center_text(draw, title, 1694, get_font(34, True), WHITE)
    center_text(draw, caption, 1750, get_font(27, False), LIGHT_BLUE)
    img.save(os.path.join(OUT, filename))

make_caption_overlay("overlay1.png", "Search by meaning", "Find notes by what they mean, not exact words.")
make_caption_overlay("overlay2.png", "Chat with your notes", "Ask questions, create summaries, and find next steps.")
make_caption_overlay("overlay3.png", "Record every meeting", "Turn lectures and calls into searchable notes.")

# Scene 4: Privacy — full dark frame
make_full_frame("scene4_frame.png", [
    ("PRIVATE AI NOTES", 500, 30, DIM, False),
    ("Your notes stay yours.", 585, 58, WHITE, True),
    ("Local A.I.  ·  No cloud  ·  No subscription", 680, 32, ACCENT, False),
    ("SemantiNote", 900, 66, WHITE, True),
    ("Try it free", 1000, 40, WHITE, True),
    ("semantinote.com", 1070, 42, PURPLE, True),
])

# Scene 5: CTA — full dark frame
make_full_frame("scene5_frame.png", [
    ("SemantiNote", 640, 72, WHITE, True),
    ("Private AI Notes", 740, 36, ACCENT, False),
    ("$9.99 once — no subscription", 870, 34, (221, 221, 221, 255), False),
    ("Free to try", 940, 30, MUTED, False),
    ("semantinote.com", 1060, 42, PURPLE, True),
    ("Mac & Windows", 1130, 24, DIM, False),
])

print(f"✅ Generated overlays in {OUT}")
