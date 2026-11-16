"""Photographic Play listing for Mangalam. Phone UI, wedding and couple photos."""

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = "/Users/tejasborate/mangalam/store/play"
SRC = "/Users/tejasborate/.cursor/projects/Users-tejasborate-mangalam/assets"
FONT = "/System/Library/Fonts/Avenir Next.ttc"
MAROON = (183, 28, 28)
GOLD = (201, 162, 39)
CREAM = (255, 248, 243)
INK = (31, 27, 22)
MUTED = (107, 98, 88)
WHITE = (255, 255, 255)
SOFT = (255, 236, 236)


def font(size, weight):
    index = {"heavy": 8, "bold": 0, "demi": 2, "medium": 5, "regular": 7}[weight]
    return ImageFont.truetype(FONT, size, index=index)


def cover(path, size, focus=(0.5, 0.42)):
    image = Image.open(f"{SRC}/{path}").convert("RGB")
    scale = max(size[0] / image.width, size[1] / image.height)
    resized = image.resize((int(image.width * scale), int(image.height * scale)), Image.Resampling.LANCZOS)
    left = int((resized.width - size[0]) * focus[0])
    top = int((resized.height - size[1]) * focus[1])
    return resized.crop((left, top, left + size[0], top + size[1]))


def fade(size, top, bottom, color=(28, 6, 8)):
    column = Image.new("L", (1, size[1]))
    pixels = column.load()
    for y in range(size[1]):
        t = y / max(size[1] - 1, 1)
        pixels[0, y] = int(top * (1 - t) + bottom * t)
    mask = column.resize(size)
    plate = Image.new("RGBA", size, color + (255,))
    plate.putalpha(mask)
    return plate


def center(draw, text, y, face, fill, width):
    box = draw.textbbox((0, 0), text, font=face)
    draw.text(((width - (box[2] - box[0])) / 2, y), text, font=face, fill=fill)


def circle_ready(path, size):
    image = Image.open(path).convert("RGBA").resize((size, size), Image.Resampling.LANCZOS)
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size - 1, size - 1), fill=255)
    image.putalpha(mask)
    return image


def circle(path, size, focus=(0.5, 0.35)):
    image = cover(path, (size, size), focus).convert("RGBA")
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size - 1, size - 1), fill=255)
    image.putalpha(mask)
    return image


def rounded(image, radius):
    mask = Image.new("L", image.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, image.width - 1, image.height - 1), radius, fill=255)
    out = image.convert("RGBA")
    out.putalpha(mask)
    return out


def phone(screen):
    bezel = 16
    width, height = screen.width + bezel * 2, screen.height + bezel * 2
    body = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(body)
    draw.rounded_rectangle((8, 14, width - 1, height + 8), 78, fill=(90, 12, 16, 90))
    draw.rounded_rectangle((0, 0, width - 1, height - 1), 78, fill=(255, 255, 255, 255))
    body.paste(rounded(screen, 64), (bezel, bezel), rounded(screen, 64))
    return body


def screen_base():
    image = Image.new("RGB", (860, 1860), CREAM)
    draw = ImageDraw.Draw(image)
    draw.text((36, 22), "9:41", font=font(20, "demi"), fill=INK)
    return image, draw


def tint_heart(size, color):
    source = Image.open("/Users/tejasborate/mangalam/mobile/assets/icon_foreground.png").convert("RGBA")
    source = source.crop(source.getchannel("A").getbbox()).resize((size, size), Image.Resampling.LANCZOS)
    pixels = source.load()
    for y in range(source.height):
        for x in range(source.width):
            _, _, _, alpha = pixels[x, y]
            pixels[x, y] = (*color, alpha)
    return source


def glyph(kind, size, color):
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    if kind == "heart":
        return tint_heart(size, color)
    if kind == "message":
        draw.rounded_rectangle((1, 1, size - 2, size - 8), 6, outline=color, width=2)
        draw.polygon([(6, size - 9), (8, size - 2), (16, size - 9)], fill=color)
    else:
        draw.ellipse((size * 0.32, 1, size * 0.68, size * 0.42), outline=color, width=2)
        draw.arc((1, size * 0.48, size - 2, size * 1.15), 200, 340, fill=color, width=2)
    return image


def nav(image, active):
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((24, 1724, 836, 1828), 32, fill=WHITE)
    items = [("Discover", "heart"), ("Likes", "heart"), ("Chats", "message"), ("Profile", "user")]
    slot = 812 / 4
    for index, (label, kind) in enumerate(items):
        color = MAROON if label == active else MUTED
        icon = glyph(kind, 26, color)
        image.paste(icon, (int(24 + slot * index + slot / 2 - 13), 1742), icon)
        face = font(15, "demi")
        box = draw.textbbox((0, 0), label, font=face)
        draw.text((24 + slot * index + (slot - (box[2] - box[0])) / 2, 1776), label, font=face, fill=color)


def profile_card(image, photo, name, age, place, tags, top):
    draw = ImageDraw.Draw(image)
    width = 788
    photo_h = 1340
    card_h = photo_h + 132
    card = Image.new("RGB", (width, card_h), WHITE)
    shot = cover(photo, (width, photo_h), (0.5, 0.28))
    card.paste(shot, (0, 0))
    scrim = fade((width, 220), 0, 190, (0, 0, 0))
    base = card.convert("RGBA")
    base.alpha_composite(scrim, (0, photo_h - 220))
    card = base.convert("RGB")
    cdraw = ImageDraw.Draw(card)
    cdraw.rounded_rectangle((16, 16, 168, 52), 16, fill=(255, 255, 255, 70) if False else (255, 255, 255))
    cdraw.text((36, 24), "Verified", font=font(16, "demi"), fill=MAROON)
    cdraw.text((24, photo_h - 78), name, font=font(32, "heavy"), fill=WHITE)
    age_face = font(18, "demi")
    age_box = cdraw.textbbox((0, 0), age, font=age_face)
    cdraw.text((width - 24 - (age_box[2] - age_box[0]), photo_h - 70), age, font=age_face, fill=WHITE)
    cdraw.text((24, photo_h - 40), place, font=font(18, "medium"), fill=(255, 255, 255))
    x = 20
    for label in tags:
        box = cdraw.textbbox((0, 0), label, font=font(16, "demi"))
        chip = box[2] - box[0] + 28
        cdraw.rounded_rectangle((x, photo_h + 16, x + chip, photo_h + 52), 16, fill=SOFT)
        cdraw.text((x + 14, photo_h + 24), label, font=font(16, "demi"), fill=MAROON)
        x += chip + 8
    cdraw.ellipse((20, photo_h + 64, 84, photo_h + 128), outline=MAROON, width=3)
    heart = tint_heart(28, MAROON)
    card.paste(heart, (38, photo_h + 82), heart)
    cdraw.text((width - 190, photo_h + 82), "View profile", font=font(20, "demi"), fill=MAROON)
    image.paste(rounded(card, 28), (36, top))
    return top + card_h


def app_bar(draw, title):
    draw.text((36, 70), title, font=font(34, "bold"), fill=INK)
    draw.ellipse((730, 72, 774, 116), outline=MUTED, width=2)
    draw.ellipse((792, 72, 836, 116), outline=MUTED, width=2)


def tabs(draw, selected):
    labels = ["Discover", "Shortlisted"]
    x = 36
    for label in labels:
        face = font(20, "demi" if label == selected else "medium")
        color = MAROON if label == selected else MUTED
        draw.text((x, 128), label, font=face, fill=color)
        box = draw.textbbox((0, 0), label, font=face)
        if label == selected:
            draw.rounded_rectangle((x, 164, x + box[2] - box[0], 170), 2, fill=MAROON)
        x += box[2] - box[0] + 28


def discover_screen(photo, name, age, place, tags):
    image, draw = screen_base()
    app_bar(draw, "Discover")
    tabs(draw, "Discover")
    profile_card(image, photo, name, age, place, tags, 196)
    nav(image, "Discover")
    return image


def shortlist_screen():
    image, draw = screen_base()
    app_bar(draw, "Discover")
    tabs(draw, "Shortlisted")
    profile_card(image, "portrait-man.jpg", "Rahul", "29 yrs", "Pune, Maharashtra", ["Engineer", "Marathi"], 196)
    nav(image, "Discover")
    return image


def chat_screen():
    image, draw = screen_base()
    avatar = circle("portrait-woman.jpg", 64, (0.52, 0.3))
    image.paste(avatar, (80, 64), avatar)
    draw.text((160, 66), "Ananya", font=font(28, "bold"), fill=INK)
    draw.text((160, 102), "You both liked each other", font=font(16, "medium"), fill=MUTED)
    draw.rounded_rectangle((36, 170, 520, 250), 18, fill=WHITE)
    draw.text((56, 194), "Hello. I liked your profile.", font=font(20, "medium"), fill=INK)
    mine = "Thank you. I would like to talk."
    box = draw.textbbox((0, 0), mine, font=font(20, "medium"))
    width = box[2] - box[0] + 40
    draw.rounded_rectangle((820 - width, 270, 820, 350), 18, fill=MAROON)
    draw.text((820 - width + 20, 294), mine, font=font(20, "medium"), fill=WHITE)
    draw.rounded_rectangle((36, 390, 700, 470), 18, fill=WHITE)
    draw.text((56, 414), "Shall we talk this evening?", font=font(20, "medium"), fill=INK)
    draw.rounded_rectangle((36, 1648, 760, 1716), 28, fill=WHITE)
    draw.text((60, 1668), "Write a message", font=font(18, "medium"), fill=MUTED)
    draw.ellipse((784, 1644, 844, 1704), fill=MAROON)
    nav(image, "Chats")
    return image


def private_screen():
    image, draw = screen_base()
    draw.text((36, 70), "Ananya", font=font(32, "bold"), fill=INK)
    photo = cover("portrait-woman.jpg", (788, 620), (0.5, 0.24))
    image.paste(rounded(photo, 24), (36, 140))
    draw.rounded_rectangle((36, 784, 824, 980), 22, fill=WHITE)
    draw.text((60, 812), "Phone", font=font(16, "demi"), fill=GOLD)
    draw.text((60, 844), "Hidden", font=font(32, "heavy"), fill=INK)
    draw.text((60, 896), "Shown only when you choose to share it.", font=font(18, "medium"), fill=MUTED)
    draw.rounded_rectangle((36, 1004, 824, 1120), 22, fill=WHITE)
    draw.text((60, 1036), "Marathi  ·  Hindu  ·  Software", font=font(20, "demi"), fill=INK)
    draw.text((60, 1072), "Nashik, Maharashtra", font=font(18, "medium"), fill=MUTED)
    nav(image, "Profile")
    return image


def photo_slide(filename, source, line_one, line_two, focus):
    image = cover(source, (1080, 1920), focus).convert("RGBA")
    image.alpha_composite(fade((1080, 1920), 150, 30))
    image.alpha_composite(fade((1080, 420), 190, 0))
    draw = ImageDraw.Draw(image)
    center(draw, "MANGALAM", 120, font(26, "demi"), GOLD, 1080)
    center(draw, line_one, 186, font(68, "heavy"), WHITE, 1080)
    center(draw, line_two, 266, font(68, "heavy"), WHITE, 1080)
    image.convert("RGB").save(f"{ROOT}/{filename}", "JPEG", quality=94)


def phone_slide(filename, background, line_one, line_two, screen, focus):
    image = cover(background, (1080, 1920), focus).filter(ImageFilter.GaussianBlur(18)).convert("RGBA")
    veil = Image.new("RGBA", (1080, 1920), (110, 16, 20, 150))
    image.alpha_composite(veil)
    image.alpha_composite(fade((1080, 1920), 80, 40, (70, 8, 12)))
    draw = ImageDraw.Draw(image)
    center(draw, line_one, 36, font(40, "heavy"), WHITE, 1080)
    center(draw, line_two, 84, font(40, "heavy"), WHITE, 1080)
    device = phone(screen)
    device.thumbnail((1000, 1760), Image.Resampling.LANCZOS)
    image.alpha_composite(device, ((1080 - device.width) // 2, 168))
    image.convert("RGB").save(f"{ROOT}/{filename}", "JPEG", quality=94)


def feature():
    image = cover("wedding-wide.jpg", (1024, 500), (0.62, 0.48)).convert("RGBA")
    shade = Image.new("RGBA", (1024, 500), (110, 14, 18, 0))
    mask = Image.new("L", (1024, 500), 0)
    pixels = mask.load()
    for x in range(1024):
        alpha = 230 if x < 430 else max(0, int(230 - (x - 430) * 1.15))
        for y in range(500):
            pixels[x, y] = alpha
    shade.putalpha(mask)
    image.alpha_composite(shade)
    mark = Image.open("/Users/tejasborate/mangalam/mobile/assets/icon_foreground.png").convert("RGBA")
    box = mark.getchannel("A").getbbox()
    mark = mark.crop(box)
    mark.thumbnail((92, 92), Image.Resampling.LANCZOS)
    image.paste(mark, (56, 78), mark)
    draw = ImageDraw.Draw(image)
    draw.text((164, 78), "Mangalam", font=font(54, "heavy"), fill=WHITE)
    draw.text((166, 148), "Matrimony for adults", font=font(24, "medium"), fill=GOLD)
    image.convert("RGB").save(f"{ROOT}/feature-graphic-1024x500.jpg", "JPEG", quality=95)


def main():
    phone_slide("01-browse-profiles.jpg", "wedding-couple.jpg", "Browse profiles", "for marriage", discover_screen("portrait-woman.jpg", "Ananya", "26 yrs", "Nashik, Maharashtra", ["Vegetarian", "Marathi"]), (0.5, 0.35))
    phone_slide("02-profile.jpg", "wedding-wide.jpg", "A real photo", "on every profile", discover_screen("wedding-couple.jpg", "Ananya", "26 yrs", "Nashik, Maharashtra", ["Hindu", "Marathi"]), (0.68, 0.45))
    phone_slide("03-shortlist.jpg", "couple-laughing.jpg", "Shortlist the", "people you like", shortlist_screen(), (0.5, 0.4))
    phone_slide("04-chat.jpg", "happy-couple.jpg", "Chat when you", "both match", chat_screen(), (0.5, 0.4))
    phone_slide("05-private.jpg", "portrait-woman.jpg", "Your number", "stays private", private_screen(), (0.5, 0.3))
    phone_slide("06-together.jpg", "couple-laughing.jpg", "For a life", "you choose together", discover_screen("portrait-man.jpg", "Rahul", "29 yrs", "Pune, Maharashtra", ["Engineer", "Marathi"]), (0.62, 0.4))
    feature()
    print("wrote", ROOT)


if __name__ == "__main__":
    main()
