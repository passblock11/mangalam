"""Play Store listing images for Mangalam. Exact sizes, no transparency."""

from PIL import Image, ImageDraw, ImageFont

ROOT = "/Users/tejasborate/mangalam/store/play"
FONT = "/System/Library/Fonts/Avenir Next.ttc"
MAROON = (183, 28, 28)
MAROON_DARK = (122, 18, 22)
GOLD = (201, 162, 39)
CREAM = (255, 248, 243)
INK = (31, 27, 22)
MUTED = (107, 98, 88)
WHITE = (255, 255, 255)
LINE = (232, 223, 214)
SOFT = (255, 236, 236)


def face(size, weight):
    index = {"heavy": 8, "bold": 0, "demi": 2, "medium": 5, "regular": 7}[weight]
    return ImageFont.truetype(FONT, size, index=index)


def center(draw, text, y, font, fill, width):
    box = draw.textbbox((0, 0), text, font=font)
    draw.text(((width - (box[2] - box[0])) / 2, y), text, font=font, fill=fill)
    return box[3] - box[1]


def heart(size):
    source = Image.open("/Users/tejasborate/mangalam/mobile/assets/icon_foreground.png").convert("RGBA")
    alpha = source.getchannel("A")
    bbox = alpha.getbbox()
    cropped = source.crop(bbox)
    cropped.thumbnail((size, size), Image.Resampling.LANCZOS)
    return cropped


def icon():
    source = Image.open("/Users/tejasborate/mangalam/mobile/assets/icon.png").convert("RGBA")
    source = source.resize((512, 512), Image.Resampling.LANCZOS)
    flat = Image.new("RGB", (512, 512), MAROON)
    flat.paste(source, mask=source.getchannel("A"))
    flat.save(f"{ROOT}/icon-512.png", "PNG")


def feature():
    image = Image.new("RGB", (1024, 500), MAROON)
    draw = ImageDraw.Draw(image)
    mark = heart(168)
    image.paste(mark, (78, 166), mark)
    draw.text((280, 150), "Mangalam", font=face(78, "heavy"), fill=WHITE)
    draw.text((284, 248), "Matrimony for adults", font=face(32, "medium"), fill=GOLD)
    draw.text((284, 308), "Verified profiles  ·  Private contact details", font=face(22, "regular"), fill=(255, 220, 210))
    image.save(f"{ROOT}/feature-graphic-1024x500.jpg", "JPEG", quality=95)


def poster(filename, line_one, line_two, paint):
    width, height = 1080, 1920
    image = Image.new("RGB", (width, height), MAROON)
    draw = ImageDraw.Draw(image)
    center(draw, "MANGALAM", 96, face(26, "demi"), GOLD, width)
    center(draw, line_one, 156, face(68, "heavy"), WHITE, width)
    center(draw, line_two, 236, face(68, "heavy"), WHITE, width)

    phone_w, phone_h = 860, 1560
    left = (width - phone_w) // 2
    top = 390
    draw.rounded_rectangle((left + 10, top + 16, left + phone_w + 10, top + phone_h + 16), 84, fill=MAROON_DARK)
    draw.rounded_rectangle((left, top, left + phone_w, top + phone_h), 84, fill=WHITE)
    screen = (left + 14, top + 14, left + phone_w - 14, top + phone_h - 14)
    draw.rounded_rectangle(screen, 72, fill=CREAM)
    draw.text((screen[0] + 36, screen[1] + 22), "9:41", font=face(18, "demi"), fill=INK)
    paint(draw, screen)
    image.save(f"{ROOT}/{filename}", "JPEG", quality=94)


def nav(draw, screen):
    x1, _, x2, y2 = screen
    y = min(y2, 1860) - 120
    draw.rounded_rectangle((x1 + 28, y, x2 - 28, y + 92), 28, fill=WHITE)
    labels = [("Discover", True), ("Likes", False), ("Chats", False), ("Profile", False)]
    slot = (x2 - x1 - 56) / 4
    for index, (label, active) in enumerate(labels):
        color = MAROON if active else MUTED
        box = draw.textbbox((0, 0), label, font=face(16, "demi"))
        text_w = box[2] - box[0]
        draw.text((x1 + 28 + slot * index + (slot - text_w) / 2, y + 34), label, font=face(16, "demi"), fill=color)


def discover(draw, screen):
    x1, y1, x2, _ = screen
    pad = x1 + 36
    draw.text((pad, y1 + 64), "Discover", font=face(34, "bold"), fill=INK)
    draw.text((pad, y1 + 122), "Discover", font=face(20, "demi"), fill=MAROON)
    draw.rounded_rectangle((pad, y1 + 156, pad + 92, y1 + 162), 2, fill=MAROON)
    draw.text((pad + 150, y1 + 122), "Shortlisted", font=face(20, "medium"), fill=MUTED)
    draw.line((pad, y1 + 168, x2 - 36, y1 + 168), fill=LINE, width=2)
    card = (pad, y1 + 176, x2 - 36, y1 + 760)
    draw.rounded_rectangle(card, 28, fill=WHITE)
    draw.ellipse((pad + 28, y1 + 208, pad + 132, y1 + 312), fill=SOFT)
    center_in = pad + 80
    draw.text((center_in - 12, y1 + 232), "A", font=face(36, "bold"), fill=MAROON)
    draw.text((pad + 156, y1 + 214), "Ananya, 26", font=face(30, "bold"), fill=INK)
    draw.text((pad + 156, y1 + 258), "Nashik, Maharashtra", font=face(20, "medium"), fill=MUTED)
    chips = ["Hindu", "Marathi", "Software"]
    cx = pad + 28
    for label in chips:
        box = draw.textbbox((0, 0), label, font=face(18, "medium"))
        w = box[2] - box[0] + 36
        draw.rounded_rectangle((cx, y1 + 340, cx + w, y1 + 386), 18, fill=SOFT)
        draw.text((cx + 18, y1 + 350), label, font=face(18, "medium"), fill=MAROON)
        cx += w + 12
    draw.text((pad + 28, y1 + 430), "Looking for a life partner", font=face(22, "medium"), fill=INK)
    draw.rounded_rectangle((pad + 28, y1 + 500, x2 - 64, y1 + 572), 26, fill=MAROON)
    label = "Like this profile"
    box = draw.textbbox((0, 0), label, font=face(22, "demi"))
    draw.text((pad + 28 + ((x2 - 64 - pad - 28) - (box[2] - box[0])) / 2, y1 + 520), label, font=face(22, "demi"), fill=WHITE)
    draw.text((pad + 28, y1 + 610), "Phone number", font=face(18, "medium"), fill=MUTED)
    draw.text((pad + 28, y1 + 642), "Hidden until you both match", font=face(22, "demi"), fill=INK)
    nav(draw, screen)


def shortlist(draw, screen):
    x1, y1, x2, _ = screen
    pad = x1 + 36
    draw.text((pad, y1 + 36), "Shortlisted", font=face(34, "bold"), fill=INK)
    draw.text((pad, y1 + 86), "People you saved", font=face(20, "medium"), fill=MUTED)
    rows = [("R", "Rahul, 29", "Pune · Engineer"), ("M", "Meera, 27", "Mumbai · Designer"), ("K", "Kabir, 31", "Nagpur · Teacher")]
    y = y1 + 150
    for initial, name, detail in rows:
        draw.rounded_rectangle((pad, y, x2 - 36, y + 150), 24, fill=WHITE)
        draw.ellipse((pad + 22, y + 34, pad + 116, y + 128), fill=SOFT)
        draw.text((pad + 52, y + 58), initial, font=face(30, "bold"), fill=MAROON)
        draw.text((pad + 140, y + 40), name, font=face(26, "bold"), fill=INK)
        draw.text((pad + 140, y + 82), detail, font=face(18, "medium"), fill=MUTED)
        y += 170
    nav(draw, screen)


def private(draw, screen):
    x1, y1, x2, _ = screen
    pad = x1 + 36
    draw.text((pad, y1 + 36), "Profile", font=face(34, "bold"), fill=INK)
    card = (pad, y1 + 110, x2 - 36, y1 + 430)
    draw.rounded_rectangle(card, 28, fill=WHITE)
    draw.text((pad + 28, y1 + 146), "Contact details", font=face(18, "demi"), fill=GOLD)
    draw.text((pad + 28, y1 + 186), "Phone number", font=face(28, "bold"), fill=INK)
    draw.rounded_rectangle((pad + 28, y1 + 246, pad + 220, y1 + 300), 18, fill=SOFT)
    draw.text((pad + 48, y1 + 258), "Hidden", font=face(20, "demi"), fill=MAROON)
    draw.text((pad + 28, y1 + 330), "Shown only when you choose", font=face(20, "medium"), fill=MUTED)
    draw.text((pad + 28, y1 + 360), "to share it.", font=face(20, "medium"), fill=MUTED)
    rows = [("Photos", "Visible to members"), ("Government ID", "Used only for verification")]
    y = y1 + 460
    for title, detail in rows:
        draw.rounded_rectangle((pad, y, x2 - 36, y + 130), 24, fill=WHITE)
        draw.text((pad + 28, y + 28), title, font=face(24, "bold"), fill=INK)
        draw.text((pad + 28, y + 70), detail, font=face(18, "medium"), fill=MUTED)
        y += 150
    nav(draw, screen)


def chat(draw, screen):
    x1, y1, x2, _ = screen
    pad = x1 + 36
    draw.text((pad, y1 + 36), "Ananya", font=face(32, "bold"), fill=INK)
    draw.text((pad, y1 + 80), "You both liked each other", font=face(18, "medium"), fill=MUTED)
    draw.rounded_rectangle((pad, y1 + 150, pad + 470, y1 + 250), 22, fill=WHITE)
    draw.text((pad + 22, y1 + 176), "Hello. I liked your profile.", font=face(20, "medium"), fill=INK)
    mine = "Thank you. I would like to talk."
    box = draw.textbbox((0, 0), mine, font=face(20, "medium"))
    bubble_w = box[2] - box[0] + 44
    draw.rounded_rectangle((x2 - 36 - bubble_w, y1 + 280, x2 - 36, y1 + 380), 22, fill=MAROON)
    draw.text((x2 - 36 - bubble_w + 22, y1 + 306), mine, font=face(20, "medium"), fill=WHITE)
    draw.rounded_rectangle((pad, y1 + 430, x2 - 36, y1 + 510), 24, fill=WHITE)
    draw.text((pad + 24, y1 + 454), "Write a message", font=face(20, "medium"), fill=MUTED)
    nav(draw, screen)


def verified(draw, screen):
    x1, y1, x2, _ = screen
    pad = x1 + 36
    draw.text((pad, y1 + 36), "Verification", font=face(34, "bold"), fill=INK)
    draw.text((pad, y1 + 88), "A selfie and a government ID", font=face(20, "medium"), fill=MUTED)
    items = [("Live selfie", "Checked on this phone"), ("Government ID", "Checked by Mangalam")]
    y = y1 + 160
    for title, detail in items:
        draw.rounded_rectangle((pad, y, x2 - 36, y + 160), 24, fill=WHITE)
        draw.ellipse((pad + 24, y + 40, pad + 104, y + 120), fill=(232, 245, 233))
        draw.text((pad + 50, y + 58), "OK", font=face(18, "bold"), fill=(30, 120, 60))
        draw.text((pad + 128, y + 42), title, font=face(26, "bold"), fill=INK)
        draw.text((pad + 128, y + 86), detail, font=face(18, "medium"), fill=MUTED)
        y += 184
    draw.text((pad, y + 10), "Members can see a verified badge.", font=face(20, "medium"), fill=MUTED)
    nav(draw, screen)


def membership(draw, screen):
    x1, y1, x2, _ = screen
    pad = x1 + 36
    draw.text((pad, y1 + 36), "Membership", font=face(34, "bold"), fill=INK)
    draw.text((pad, y1 + 88), "Choose a plan in the app", font=face(20, "medium"), fill=MUTED)
    plans = [("1 month", False), ("3 months", True), ("1 year", False)]
    y = y1 + 160
    for label, selected in plans:
        fill = MAROON if selected else WHITE
        title = WHITE if selected else INK
        detail = (255, 220, 210) if selected else MUTED
        draw.rounded_rectangle((pad, y, x2 - 36, y + 140), 24, fill=fill)
        draw.text((pad + 28, y + 32), label, font=face(28, "bold"), fill=title)
        draw.text((pad + 28, y + 78), "Renews until you cancel", font=face(18, "medium"), fill=detail)
        y += 164
    nav(draw, screen)


def main():
    icon()
    feature()
    poster("01-browse-profiles.jpg", "Browse profiles", "for marriage", discover)
    poster("02-shortlist.jpg", "Shortlist the", "people you like", shortlist)
    poster("03-private-number.jpg", "Your number", "stays private", private)
    poster("04-chat.jpg", "Chat when you", "both match", chat)
    poster("05-verified.jpg", "Verified with a", "live selfie", verified)
    poster("06-membership.jpg", "Membership for", "serious matches", membership)
    print("wrote", ROOT)


if __name__ == "__main__":
    main()
