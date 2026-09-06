#!/usr/bin/env python3
from PIL import Image, ImageDraw, ImageFont
import os
import sys

W, H = 1080, 1920
BG = "#101114"
PANEL = "#1b1c20"
PANEL_2 = "#222329"
BORDER = "#373941"
WHITE = "#f5f4f7"
MUTED = "#a3a5ad"
DIM = "#777982"
PURPLE = "#7766d9"
PURPLE_LIGHT = "#9f91ff"
PURPLE_DARK = "#312d50"
GREEN = "#4ec49d"
ORANGE = "#f0945d"
BLUE = "#65a8e4"

out = sys.argv[1]
shots = os.path.join(os.path.dirname(os.path.abspath(__file__)), "shots")


def font(size, bold=False):
    face = "/System/Library/Fonts/HelveticaNeue.ttc"
    return ImageFont.truetype(face, size, index=1 if bold else 0)


def rounded(draw, box, radius=14, fill=PANEL, outline=None, width=1):
    draw.rounded_rectangle(box, radius, fill=fill, outline=outline, width=width)


def label(draw, xy, text, size=22, color=WHITE, bold=False):
    draw.text(xy, text, font=font(size, bold), fill=color)


def multi(draw, xy, text, max_width, size=24, color=WHITE, bold=False, leading=10):
    words = text.split()
    lines, current = [], ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if draw.textlength(candidate, font=font(size, bold)) <= max_width:
            current = candidate
        else:
            lines.append(current)
            current = word
    if current:
        lines.append(current)
    y = xy[1]
    for line in lines:
        label(draw, (xy[0], y), line, size, color, bold)
        y += size + leading
    return y


def header(draw, title, subtitle):
    label(draw, (60, 75), title, 52, WHITE, True)
    label(draw, (60, 142), subtitle, 28, MUTED)


def meeting_platforms(img, draw):
    def card(x, y):
        rounded(draw, (x, y, x + 450, y + 82), 12, fill="#202126", outline=BORDER, width=1)

    def logo(filename, x, y, max_width, max_height):
        mark = Image.open(os.path.join(shots, "..", "meeting-platforms", filename)).convert("RGBA")
        mark.thumbnail((max_width, max_height), Image.Resampling.LANCZOS)
        img.alpha_composite(mark, (x, y + (max_height - mark.height) // 2))

    # Published platform marks retain their original geometry and colors.
    card(60, 220)
    logo("zoom-wordmark.png", 100, 240, 270, 44)

    card(570, 220)
    logo("teams-wordmark.png", 600, 239, 48, 48)
    label(draw, (675, 247), "Microsoft Teams", 25, "#8b8df0", False)

    card(60, 318)
    logo("meet-wordmark.png", 88, 330, 56, 56)
    label(draw, (165, 344), "Google Meet", 28, WHITE, True)

    card(570, 318)
    logo("webex-wordmark.png", 600, 337, 175, 42)


def app_top(draw, title):
    rounded(draw, (35, 285, 1045, 1435), 12, fill="#17181c", outline=BORDER, width=2)
    draw.rectangle((36, 286, 1044, 350), fill="#26272c")
    rounded(draw, (58, 301, 92, 335), 8, fill=PURPLE)
    label(draw, (66, 304), "S", 20, WHITE, True)
    label(draw, (105, 305), "SemantiNote", 24, WHITE, True)
    label(draw, (855, 307), "Local & private", 18, MUTED)
    label(draw, (62, 385), title, 20, MUTED, True)


def real_app_scene(filename, crop, title, subtitle, output_name):
    source = Image.open(os.path.join(shots, filename)).convert("RGB")
    frame = source.crop(crop)
    available_width = W - 60
    scale = available_width / frame.width
    scaled = frame.resize((available_width, int(frame.height * scale)), Image.Resampling.LANCZOS)

    img = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(img)
    header(draw, title, subtitle)
    y = max(255, (H - scaled.height) // 2 + 120)
    img.paste(scaled, (30, y))
    img.save(os.path.join(out, output_name))


def real_app_canvas(filename, crop, title, subtitle):
    source = Image.open(os.path.join(shots, filename)).convert("RGB")
    frame = source.crop(crop)
    scale = (W - 60) / frame.width
    scaled = frame.resize((W - 60, int(frame.height * scale)), Image.Resampling.LANCZOS)
    img = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(img)
    header(draw, title, subtitle)
    y = max(255, (H - scaled.height) // 2 + 120)
    img.paste(scaled, (30, y))
    return img, draw, y


def search_scene():
    # The no-match state comes from the real search recording; use an unmodified
    # crop of the app screenshot for the semantic result reveal.
    real_app_scene(
        "search.png", (65, 115, 900, 1270), "Search the way you remember.",
        "Semantic search finds related lecture notes.", "scene1_frame.png"
    )


def chat_scene():
    real_app_scene(
        "chat.png", (1050, 90, 2360, 1510), "Ask about what you learned.",
        "A lecture note stays visible beside the AI.", "scene2_note_frame.png"
    )
    real_app_scene(
        "chat.png", (1630, 90, 2640, 1510), "Ask about what you learned.",
        "Get the answer from your own notes.", "scene2_frame.png"
    )


def meeting_scene():
    for index in range(1, 4):
        img, draw, _ = real_app_canvas(
            "meeting.png", (680, 150, 1980, 1530), "Record meetings privately.",
            "Zoom, Teams, Meet, Webex, and more.",
        )
        img = img.convert("RGBA")
        meeting_platforms(img, ImageDraw.Draw(img))
        img.convert("RGB").save(os.path.join(out, f"scene3-{index}.png"))


def search_footer_mask():
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.rectangle((220, 1622, 1020, 1662), fill="#303031")
    label(draw, (230, 1632), "SemantiNote Demo", 18, "#d4d4d4")
    img.save(os.path.join(out, "search_footer_mask.png"))


def chat_status_mask():
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.rectangle((380, 510, 456, 548), fill="#303031")
    img.save(os.path.join(out, "chat_status_mask.png"))


search_scene()
chat_scene()
meeting_scene()
search_footer_mask()
chat_status_mask()
print(f"Generated replacement reel scenes in {out}")
