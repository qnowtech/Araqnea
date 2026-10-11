"""Diagramas propios de la notación de Quantum in Pictures.

No son las páginas del libro. Cada figura es una igualdad del cálculo,
dibujada para el resumen de lab/chapters.
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
SCALE = 2
PAPER = (255, 255, 255)
INK = (28, 28, 28)
MUTED = (85, 85, 85)
GREEN = (46, 158, 58)
RED = (214, 54, 47)
WHITE = (255, 255, 255)
BOX_FILL = (255, 250, 240)


def font(size, bold=False):
    name = "segoeuib.ttf" if bold else "segoeui.ttf"
    return ImageFont.truetype(rf"C:\Windows\Fonts\{name}", int(size * SCALE))


class C:
    def __init__(self, w, h):
        self.w = w
        self.h = h
        self.im = Image.new("RGB", (w * SCALE, h * SCALE), PAPER)
        self.d = ImageDraw.Draw(self.im)

    def s(self, v):
        return int(round(v * SCALE))

    def line(self, pts, width=4, fill=INK):
        xy = [(self.s(x), self.s(y)) for x, y in pts]
        self.d.line(xy, fill=fill, width=max(2, int(width * SCALE * 0.55)), joint="curve")

    def curve(self, p0, p1, p2, p3, width=4, fill=INK, n=28):
        pts = []
        for i in range(n + 1):
            t = i / n
            u = 1 - t
            x = u**3 * p0[0] + 3 * u**2 * t * p1[0] + 3 * u * t**2 * p2[0] + t**3 * p3[0]
            y = u**3 * p0[1] + 3 * u**2 * t * p1[1] + 3 * u * t**2 * p2[1] + t**3 * p3[1]
            pts.append((x, y))
        self.line(pts, width=width, fill=fill)

    def text(self, x, y, s, size=15, fill=INK, bold=False, anchor="mm"):
        self.d.text((self.s(x), self.s(y)), s, font=font(size, bold), fill=fill, anchor=anchor)

    def eq(self, x, y):
        self.text(x, y, "=", size=28, bold=True)

    def neq(self, x, y):
        self.text(x, y, "≠", size=28, bold=True)

    def spider(self, x, y, color, phase="", r=20):
        self.d.ellipse(
            [self.s(x - r), self.s(y - r), self.s(x + r), self.s(y + r)],
            fill=color,
            outline=INK,
            width=max(2, int(2 * SCALE * 0.6)),
        )
        if phase:
            self.text(x, y + 1, phase, size=13 if len(phase) > 3 else 14, fill=WHITE, bold=True)

    def wire(self, x, y0, y1, width=4):
        self.line([(x, y0), (x, y1)], width=width)

    def double(self, x, y0, y1, gap=6):
        self.wire(x - gap / 2, y0, y1)
        self.wire(x + gap / 2, y0, y1)

    def discard(self, x, y):
        """Test de descarte. El hilo llega desde abajo a (x, y)."""
        self.line([(x, y), (x, y - 18)])
        top = y - 18
        self.line([(x - 20, top), (x + 20, top)], width=3)
        self.line([(x - 13, top - 8), (x + 13, top - 8)], width=3)
        self.line([(x - 6, top - 16), (x + 6, top - 16)], width=3)

    def noise(self, x, y):
        """Estado de ruido. El hilo sale hacia arriba desde (x, y)."""
        self.line([(x, y), (x, y - 18)])
        base = y
        self.line([(x - 6, base), (x + 6, base)], width=3)
        self.line([(x - 13, base + 8), (x + 13, base + 8)], width=3)
        self.line([(x - 20, base + 16), (x + 20, base + 16)], width=3)

    def hbox(self, x, y, s=15):
        tl, tr, br, bl = (x - s, y - s), (x + s, y - s), (x + s, y + s), (x - s, y + s)
        mid = (x, y)
        quads = [
            (tl, tr, mid, GREEN),
            (tr, br, mid, RED),
            (br, bl, mid, GREEN),
            (bl, tl, mid, RED),
        ]
        for a, b, c, col in quads:
            self.d.polygon([(self.s(a[0]), self.s(a[1])), (self.s(b[0]), self.s(b[1])), (self.s(c[0]), self.s(c[1]))], fill=col)
        self.line([tl, tr, br, bl, tl], width=3)
        self.line([tl, br], width=2)
        self.line([tr, bl], width=2)

    def trap(self, x, y, w=56, h=40, skew=12, label="", flip=False):
        sk = -skew if flip else skew
        pts = [
            (x - w / 2 + sk, y - h / 2),
            (x + w / 2 + sk, y - h / 2),
            (x + w / 2 - sk, y + h / 2),
            (x - w / 2 - sk, y + h / 2),
        ]
        self.d.polygon([(self.s(px), self.s(py)) for px, py in pts], fill=BOX_FILL, outline=INK)
        self.line(pts + [pts[0]], width=3)
        # Marca que delata el volteo vertical: queda arriba o abajo.
        dy = (h * 0.22) if flip else -(h * 0.22)
        self.d.ellipse(
            [self.s(x + 10 - 4), self.s(y + dy - 4), self.s(x + 10 + 4), self.s(y + dy + 4)],
            fill=INK,
        )
        if label:
            self.text(x - 6, y, label, size=16, bold=True)

    def cup(self, x, y, w, depth):
        self.curve((x, y), (x, y + depth), (x + w, y + depth), (x + w, y))

    def cap(self, x, y, w, depth):
        self.curve((x, y), (x, y - depth), (x + w, y - depth), (x + w, y))

    def save(self, path):
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        self.im.save(path, "PNG")


def ch(n):
    return ROOT / f"{n}" / "img"


def c1():
    out = ch("01-hilos-y-cajas")
    c = C(920, 230)
    c.text(460, 24, "Ingredientes", size=18, bold=True)
    c.wire(70, 50, 190)
    c.text(70, 205, "hilo", size=14, fill=MUTED)
    c.wire(250, 150, 190)
    c.trap(250, 115, label="")
    c.wire(250, 95, 55)
    c.text(310, 70, "salida", size=13, fill=MUTED, anchor="lm")
    c.text(310, 175, "entrada", size=13, fill=MUTED, anchor="lm")
    c.text(250, 205, "caja", size=14, fill=MUTED)
    c.trap(470, 130)
    c.wire(470, 110, 55)
    c.text(470, 205, "estado", size=14, fill=MUTED)
    c.text(530, 150, "sin entrada", size=13, fill=MUTED, anchor="lm")
    c.wire(700, 190, 145)
    c.trap(700, 120)
    c.text(700, 205, "test", size=14, fill=MUTED)
    c.text(760, 100, "sin salida", size=13, fill=MUTED, anchor="lm")
    c.save(out / "01-ingredientes.png")

    # Una pieza por sección. Mismos trazos que la lámina, sin mezclarlas.
    c = C(180, 230)
    c.wire(90, 50, 190)
    c.text(90, 210, "hilo", size=14, fill=MUTED)
    c.save(out / "1.1 Hilo.png")

    c = C(280, 230)
    c.wire(90, 150, 190)
    c.trap(90, 115)
    c.wire(90, 95, 55)
    c.text(150, 70, "salida", size=13, fill=MUTED, anchor="lm")
    c.text(150, 175, "entrada", size=13, fill=MUTED, anchor="lm")
    c.text(90, 210, "caja", size=14, fill=MUTED)
    c.save(out / "1.2 Caja.png")

    c = C(280, 230)
    c.trap(90, 130)
    c.wire(90, 110, 55)
    c.text(150, 150, "sin entrada", size=13, fill=MUTED, anchor="lm")
    c.text(90, 210, "estado", size=14, fill=MUTED)
    c.save(out / "1.3 Estado.png")

    c = C(280, 230)
    c.wire(90, 190, 145)
    c.trap(90, 120)
    c.text(150, 100, "sin salida", size=13, fill=MUTED, anchor="lm")
    c.text(90, 210, "test", size=14, fill=MUTED)
    c.save(out / "1.4 Test.png")

    c = C(220, 280)
    c.trap(110, 78)
    c.wire(110, 98, 168)
    c.trap(110, 188)
    c.text(110, 255, "número", size=14, fill=MUTED)
    c.save(out / "1.5 Número.png")

    c = C(260, 230)
    c.line([(70, 55), (70, 100)])
    c.cup(70, 100, 120, 70)
    c.line([(190, 100), (190, 55)])
    c.text(130, 205, "taza", size=14, fill=MUTED)
    c.save(out / "1.6 Taza.png")

    c = C(260, 230)
    c.line([(70, 175), (70, 130)])
    c.cap(70, 130, 120, 70)
    c.line([(190, 175), (190, 130)])
    c.text(130, 205, "tapa", size=14, fill=MUTED)
    c.save(out / "1.7 Tapa.png")

    c = C(780, 250)
    c.text(390, 24, "Tirón", size=18, bold=True)
    c.line([(70, 210), (70, 168)])
    c.curve((70, 168), (70, 214), (175, 214), (175, 168))
    c.line([(175, 168), (175, 92)])
    c.curve((175, 92), (175, 46), (70, 46), (70, 92))
    c.line([(70, 92), (70, 42)])
    c.eq(280, 125)
    c.wire(380, 42, 210)
    c.text(390, 232, "taza bajo tapa  =  hilo recto", size=14, fill=MUTED)
    c.save(out / "02-tiron.png")

    c = C(980, 250)
    c.text(490, 22, "Deslizamiento", size=18, bold=True)
    # tres tazas con la caja en la pata izquierda, en el fondo y en la pata derecha
    def cup_box(x, where):
        if where == "B":
            c.line([(x, 60), (x, 145)])
            c.curve((x, 145), (x, 185), (x + 20, 198), (x + 28, 188))
            c.trap(x + 45, 188, w=36, h=26, skew=0, label="")
            c.curve((x + 62, 188), (x + 70, 198), (x + 90, 185), (x + 90, 145))
            c.line([(x + 90, 145), (x + 90, 60)])
            return
        c.line([(x, 60), (x, 150)])
        c.cup(x, 150, 90, 55)
        c.line([(x + 90, 150), (x + 90, 60)])
        if where == "L":
            c.trap(x, 115, w=42, h=32, label="")
        else:
            c.trap(x + 90, 115, w=42, h=32, skew=-12, label="")

    cup_box(70, "L")
    c.eq(250, 130)
    cup_box(310, "B")
    c.eq(530, 130)
    cup_box(590, "R")
    c.text(490, 236, "la caja se desliza por el doblez y sigue siendo la misma", size=14, fill=MUTED)
    c.save(out / "03-deslizamiento.png")

    c = C(920, 280)
    c.text(460, 22, "Volteo", size=18, bold=True)
    c.wire(90, 200, 165)
    c.trap(90, 140, label="f")
    c.wire(90, 120, 85)
    c.trap(90, 70, label="f", flip=True)
    c.wire(90, 50, 40)
    c.eq(180, 120)
    c.wire(250, 40, 200)
    c.text(300, 120, "después", size=13, fill=MUTED, anchor="lm")

    c.wire(520, 200, 165)
    c.trap(520, 140, label="f", flip=True)
    c.wire(520, 120, 85)
    c.trap(520, 70, label="f")
    c.wire(520, 50, 40)
    c.eq(610, 120)
    c.wire(680, 40, 200)
    c.text(730, 120, "antes", size=13, fill=MUTED, anchor="lm")
    c.text(460, 250, "se deshace al voltear          se deshace también antes: por los dos lados", size=14, fill=MUTED)
    c.save(out / "04-voltear.png")

    c = C(860, 250)
    c.text(430, 22, "Fusión de tazas", size=18, bold=True)
    c.line([(70, 55), (70, 120)])
    c.curve((70, 120), (70, 185), (150, 185), (190, 130))
    c.curve((190, 130), (210, 95), (250, 95), (270, 130))
    c.curve((270, 130), (310, 185), (390, 185), (390, 120))
    c.line([(390, 120), (390, 55)])
    c.eq(470, 130)
    c.line([(540, 55), (540, 120)])
    c.cup(540, 120, 200, 70)
    c.line([(740, 120), (740, 55)])
    c.text(430, 230, "dos tazas unidas por una tapa  =  una taza", size=14, fill=MUTED)
    c.save(out / "05-fusion-tazas.png")


def c2():
    out = ch("02-un-mundo-de-aranas")
    c = C(720, 280)
    c.text(360, 22, "Fusión", size=18, bold=True)
    c.wire(160, 55, 78)
    c.spider(160, 100, GREEN, "90°", r=22)
    c.wire(160, 122, 148)
    c.spider(160, 172, GREEN, "90°", r=22)
    c.wire(160, 194, 230)
    c.eq(300, 140)
    c.wire(460, 55, 110)
    c.spider(460, 140, GREEN, "180°", r=26)
    c.wire(460, 166, 230)
    c.text(360, 258, "mismo color y una pata en común. 90° + 90° = 180°. Módulo 360°.", size=14, fill=MUTED)
    c.save(out / "01-fusion.png")

    c = C(900, 250)
    c.text(450, 22, "Las patas de fase 0°", size=18, bold=True)
    c.wire(80, 190, 145)
    c.spider(80, 120, GREEN, "0°", r=20)
    c.wire(80, 100, 50)
    c.eq(150, 120)
    c.wire(210, 50, 190)
    c.text(210, 220, "hilo", size=14, fill=MUTED)

    c.spider(360, 150, GREEN, "0°", r=20)
    c.line([(330, 70), (360, 130)])
    c.line([(390, 70), (360, 130)])
    c.eq(450, 130)
    c.cup(500, 70, 80, 70)
    c.line([(500, 70), (500, 55)])
    c.line([(580, 70), (580, 55)])
    c.text(540, 220, "taza", size=14, fill=MUTED)

    c.spider(700, 90, GREEN, "0°", r=20)
    c.line([(675, 155), (700, 108)])
    c.line([(725, 155), (700, 108)])
    c.eq(770, 110)
    c.cap(800, 130, 70, 40)
    c.line([(800, 150), (800, 165)])
    c.line([(870, 150), (870, 165)])
    c.text(800, 220, "tapa", size=14, fill=MUTED)
    c.save(out / "02-patas-cero.png")

    c = C(320, 250)
    c.wire(80, 190, 145)
    c.spider(80, 120, GREEN, "0°", r=20)
    c.wire(80, 100, 50)
    c.eq(160, 120)
    c.wire(230, 50, 190)
    c.text(160, 225, "hilo", size=14, fill=MUTED)
    c.save(out / "2.1 Hilo.png")

    c = C(360, 250)
    c.spider(80, 160, GREEN, "0°", r=20)
    c.line([(50, 70), (80, 140)])
    c.line([(110, 70), (80, 140)])
    c.eq(170, 130)
    c.cup(210, 80, 90, 70)
    c.line([(210, 80), (210, 55)])
    c.line([(300, 80), (300, 55)])
    c.text(180, 225, "taza", size=14, fill=MUTED)
    c.save(out / "2.2 Taza.png")

    c = C(360, 250)
    c.spider(80, 80, GREEN, "0°", r=20)
    c.line([(55, 150), (80, 98)])
    c.line([(105, 150), (80, 98)])
    c.eq(170, 120)
    c.cap(210, 140, 90, 50)
    c.line([(210, 140), (210, 185)])
    c.line([(300, 140), (300, 185)])
    c.text(180, 225, "tapa", size=14, fill=MUTED)
    c.save(out / "2.3 Tapa.png")

    c = C(920, 390)
    c.text(460, 22, "Corte de patas", size=18, bold=True)
    # dos patas caen
    c.line([(70, 70), (120, 100)])
    c.line([(170, 70), (120, 100)])
    c.spider(120, 115, RED, r=18)
    c.line([(110, 132), (110, 175)])
    c.line([(130, 132), (130, 175)])
    c.spider(120, 192, GREEN, r=18)
    c.line([(80, 250), (120, 210)])
    c.line([(160, 250), (120, 210)])
    c.eq(230, 160)
    c.line([(280, 70), (320, 100)])
    c.line([(360, 70), (320, 100)])
    c.spider(320, 115, RED, r=18)
    c.spider(320, 200, GREEN, r=18)
    c.line([(280, 250), (320, 218)])
    c.line([(360, 250), (320, 218)])
    c.text(190, 280, "dos patas: caen las dos", size=13, fill=MUTED)

    # tres patas dejan una
    c.line([(520, 70), (590, 105)])
    c.line([(660, 70), (590, 105)])
    c.spider(590, 120, GREEN, r=18)
    c.line([(575, 136), (575, 178)])
    c.line([(590, 136), (590, 178)])
    c.line([(605, 136), (605, 178)])
    c.spider(590, 196, RED, r=18)
    c.line([(540, 250), (590, 214)])
    c.line([(640, 250), (590, 214)])
    c.eq(720, 160)
    c.line([(760, 70), (810, 105)])
    c.line([(860, 70), (810, 105)])
    c.spider(810, 120, GREEN, r=18)
    c.line([(810, 138), (810, 178)])
    c.spider(810, 196, RED, r=18)
    c.line([(760, 250), (810, 214)])
    c.line([(860, 250), (810, 214)])
    c.text(700, 280, "tres patas: queda una", size=13, fill=MUTED)
    c.text(460, 340, "n patas entre distinto color quedan en n módulo 2.", size=15, fill=MUTED)
    c.text(460, 365, "Con una pata no se cortan: hace falta al menos un par.", size=14, fill=MUTED)
    c.save(out / "03-corte-patas.png")

    c = C(780, 250)
    c.text(390, 22, "Copia", size=18, bold=True)
    c.line([(120, 55), (150, 90)])
    c.line([(180, 55), (150, 90)])
    c.spider(150, 108, GREEN, r=18)
    c.wire(150, 126, 160)
    c.spider(150, 178, RED, "α", r=18)
    c.eq(280, 120)
    c.line([(400, 55), (400, 90)])
    c.spider(400, 110, RED, "α", r=18)
    c.line([(500, 55), (500, 90)])
    c.spider(500, 110, RED, "α", r=18)
    c.text(390, 220, "una araña de una pata la copia el otro color. El mismo color se fusiona.", size=14, fill=MUTED)
    c.save(out / "04-copia.png")

    c = C(900, 300)
    c.text(450, 22, "Cambio de color", size=18, bold=True)
    c.wire(70, 70, 95)
    c.hbox(70, 112)
    c.wire(70, 128, 155)
    c.spider(70, 172, GREEN, "α", r=18)
    c.wire(70, 190, 215)
    c.hbox(70, 232)
    c.eq(150, 150)
    c.wire(210, 70, 130)
    c.spider(210, 155, RED, "α", r=18)
    c.wire(210, 173, 240)

    c.wire(400, 200, 155)
    c.hbox(400, 138)
    c.wire(400, 122, 95)
    c.hbox(400, 78)
    c.wire(400, 62, 50)
    c.eq(470, 130)
    c.wire(540, 50, 200)

    c.wire(650, 200, 165)
    c.hbox(650, 145)
    c.wire(650, 128, 110)
    c.spider(650, 92, GREEN, "α", r=16)
    c.eq(730, 130)
    c.wire(800, 200, 155)
    c.spider(800, 138, RED, "α", r=16)
    c.wire(800, 120, 100)
    c.hbox(800, 82)
    c.wire(800, 66, 50)
    c.text(450, 275, "en todas las patas cambia el color. Dos cajas seguidas son el hilo. Empujar la caja también.", size=13, fill=MUTED)
    c.save(out / "05-cambio-color.png")

    c = C(820, 240)
    c.text(410, 22, "Puertas", size=18, bold=True)
    c.wire(120, 200, 145)
    c.spider(120, 120, RED, "180°", r=24)
    c.wire(120, 96, 55)
    c.text(120, 220, "NOT", size=14, fill=MUTED)

    c.spider(300, 175, RED, "0°", r=16)
    c.wire(300, 159, 136)
    c.spider(300, 114, RED, "180°", r=18)
    c.wire(300, 96, 55)
    c.eq(390, 120)
    c.spider(470, 140, RED, "180°", r=18)
    c.wire(470, 122, 55)
    c.text(390, 215, "0° + 180° = 180°", size=14, fill=MUTED)

    c.wire(620, 200, 155)
    c.wire(740, 200, 155)
    c.spider(620, 130, GREEN, r=18)
    c.spider(740, 130, RED, r=18)
    c.line([(638, 130), (722, 130)])
    c.wire(620, 112, 55)
    c.wire(740, 112, 55)
    c.text(680, 220, "CNOT", size=14, fill=MUTED)
    c.save(out / "06-puertas.png")

    c = C(220, 250)
    c.wire(110, 200, 145)
    c.spider(110, 120, RED, "180°", r=24)
    c.wire(110, 96, 55)
    c.text(110, 225, "NOT", size=14, fill=MUTED)
    c.save(out / "2.4 NOT.png")

    c = C(280, 250)
    c.wire(90, 200, 155)
    c.wire(190, 200, 155)
    c.spider(90, 130, GREEN, r=18)
    c.spider(190, 130, RED, r=18)
    c.line([(108, 130), (172, 130)])
    c.wire(90, 112, 55)
    c.wire(190, 112, 55)
    c.text(140, 225, "CNOT", size=14, fill=MUTED)
    c.save(out / "2.5 CNOT.png")

    c = C(640, 200)
    c.text(320, 22, "Volteo vertical de una fase", size=18, bold=True)
    c.wire(120, 160, 125)
    c.spider(120, 100, GREEN, "90°", r=24)
    c.wire(120, 76, 50)
    c.text(250, 100, "→", size=28, bold=True)
    c.wire(400, 160, 125)
    c.spider(400, 100, GREEN, "270°", r=24)
    c.wire(400, 76, 50)
    c.text(320, 185, "360° − 90°  =  270°", size=14, fill=MUTED)
    c.save(out / "07-volteo-fase.png")


def c3():
    out = ch("03-mantener-contento-a-einstein")
    c = C(760, 230)
    c.text(380, 22, "Descarte y ruido", size=18, bold=True)
    c.wire(120, 180, 130)
    c.discard(120, 130)
    c.text(120, 210, "descarte", size=14, fill=MUTED)
    c.text(250, 110, "volteo", size=14, fill=MUTED)
    c.text(250, 135, "vertical", size=14, fill=MUTED)
    c.text(340, 120, "=", size=28, bold=True)
    c.noise(500, 150)
    c.wire(500, 132, 55)
    c.text(500, 210, "ruido", size=14, fill=MUTED)
    c.save(out / "01-descarte.png")

    c = C(860, 250)
    c.text(430, 22, "Caja segura", size=18, bold=True)
    c.wire(150, 200, 165)
    c.trap(150, 140, label="")
    c.wire(150, 120, 85)
    c.discard(150, 85)
    c.eq(280, 140)
    c.wire(400, 200, 150)
    c.discard(400, 150)
    c.text(430, 225, "descartar la salida  =  descartar la entrada. En todas las patas.", size=14, fill=MUTED)
    c.save(out / "02-caja-segura.png")

    c = C(920, 280)
    c.text(460, 22, "Tests que sí ocurren, y la tapa que no", size=18, bold=True)
    c.wire(70, 150, 115)
    c.spider(70, 95, GREEN, "0°", r=18)
    c.text(130, 100, "+", size=22, bold=True)
    c.wire(190, 150, 115)
    c.spider(190, 95, GREEN, "180°", r=20)
    c.eq(280, 110)
    c.wire(360, 160, 120)
    c.discard(360, 120)
    c.text(200, 185, "uno de los dos ocurre", size=13, fill=MUTED)

    c.cap(560, 130, 70, 40)
    c.line([(560, 130), (560, 155)])
    c.line([(630, 130), (630, 155)])
    c.neq(700, 110)
    c.wire(760, 155, 120)
    c.discard(760, 120)
    c.wire(820, 155, 120)
    c.discard(820, 120)
    c.text(700, 210, "la tapa no es el descarte", size=13, fill=MUTED)
    c.text(460, 255, "Si la tapa fuera el descarte de dos hilos, al doblar una pata todo hilo se rompería.", size=14, fill=MUTED)
    c.save(out / "03-tests.png")

    c = C(480, 240)
    c.wire(70, 150, 115)
    c.spider(70, 95, GREEN, "0°", r=18)
    c.text(130, 100, "+", size=22, bold=True)
    c.wire(190, 150, 115)
    c.spider(190, 95, GREEN, "180°", r=20)
    c.eq(280, 110)
    c.wire(360, 160, 120)
    c.discard(360, 120)
    c.text(240, 210, "uno de los dos ocurre", size=13, fill=MUTED)
    c.save(out / "3.1 Suma.png")

    c = C(420, 240)
    c.cap(70, 120, 70, 40)
    c.line([(70, 120), (70, 150)])
    c.line([(140, 120), (140, 150)])
    c.neq(200, 110)
    c.wire(260, 155, 115)
    c.discard(260, 115)
    c.wire(320, 155, 115)
    c.discard(320, 115)
    c.text(210, 210, "la tapa no es el descarte", size=13, fill=MUTED)
    c.save(out / "3.2 Tapa.png")


def c4():
    out = ch("04-particulas-cuanticas-y-ordinarias")
    c = C(900, 280)
    c.text(450, 22, "Medición y codificación", size=18, bold=True)
    c.double(90, 200, 145)
    c.spider(90, 125, GREEN, r=18)
    c.wire(90, 107, 55)
    c.text(90, 230, "medición", size=14, fill=MUTED)
    c.text(150, 80, "ordinario", size=12, fill=MUTED, anchor="lm")
    c.text(150, 180, "cuántico", size=12, fill=MUTED, anchor="lm")

    c.wire(280, 200, 150)
    c.spider(280, 130, GREEN, r=18)
    c.double(280, 112, 55)
    c.text(280, 230, "codificación", size=14, fill=MUTED)

    c.wire(470, 230, 185)
    c.spider(470, 168, GREEN, r=16)
    c.double(470, 152, 115)
    c.spider(470, 98, GREEN, r=16)
    c.wire(470, 82, 50)
    c.eq(560, 130)
    c.wire(640, 50, 230)
    c.text(700, 130, "fusión", size=14, fill=MUTED, anchor="lm")
    c.text(450, 262, "codificar y medir del mismo color es no hacer nada, en el hilo ordinario", size=14, fill=MUTED)
    c.save(out / "01-medicion.png")

    c = C(320, 270)
    c.double(100, 210, 155)
    c.spider(100, 135, GREEN, r=18)
    c.wire(100, 117, 55)
    c.text(170, 70, "ordinario", size=12, fill=MUTED, anchor="lm")
    c.text(170, 185, "cuántico", size=12, fill=MUTED, anchor="lm")
    c.text(100, 245, "medición", size=14, fill=MUTED)
    c.save(out / "4.1 Medición.png")

    c = C(280, 270)
    c.wire(140, 210, 160)
    c.spider(140, 140, GREEN, r=18)
    c.double(140, 122, 55)
    c.text(140, 245, "codificación", size=14, fill=MUTED)
    c.save(out / "4.2 Codificación.png")

    c = C(420, 280)
    c.wire(90, 240, 195)
    c.spider(90, 178, GREEN, r=16)
    c.double(90, 162, 125)
    c.spider(90, 108, GREEN, r=16)
    c.wire(90, 92, 50)
    c.eq(180, 140)
    c.wire(260, 50, 240)
    c.text(320, 140, "hilo ordinario", size=13, fill=MUTED, anchor="lm")
    c.save(out / "4.3 Fusión.png")

    c = C(280, 340)
    c.double(140, 280, 226)
    c.spider(140, 210, GREEN, r=16)
    c.wire(140, 194, 166)
    c.spider(140, 150, GREEN, r=16)
    c.double(140, 134, 55)
    c.text(140, 315, "borrado de fase", size=14, fill=MUTED)
    c.save(out / "4.4 Borrado.png")

    c = C(640, 200)
    c.text(320, 22, "Dos tazas distintas", size=18, bold=True)
    c.cup(80, 60, 120, 70)
    c.line([(80, 60), (80, 48)])
    c.line([(200, 60), (200, 48)])
    c.text(140, 165, "ordinaria", size=14, fill=MUTED)
    c.neq(300, 100)
    c.cup(380, 60, 120, 70)
    c.cup(388, 68, 104, 58)
    c.line([(380, 60), (380, 48)])
    c.line([(500, 60), (500, 48)])
    c.text(440, 165, "cuántica", size=14, fill=MUTED)
    c.save(out / "02-tazas.png")

    c = C(860, 250)
    c.text(430, 22, "Fundir no es copiar", size=18, bold=True)
    c.line([(110, 55), (150, 90)])
    c.line([(190, 55), (150, 90)])
    c.spider(150, 108, GREEN, "90°", r=22)
    c.text(150, 175, "una sola araña", size=13, fill=MUTED)
    c.neq(310, 110)
    c.line([(430, 55), (430, 85)])
    c.spider(430, 105, GREEN, "90°", r=20)
    c.line([(560, 55), (560, 85)])
    c.spider(560, 105, GREEN, "90°", r=20)
    c.text(495, 175, "dos estados separados", size=13, fill=MUTED)
    c.text(430, 220, "El mismo color se fusiona. Eso no son dos copias del estado de 90°.", size=14, fill=MUTED)
    c.save(out / "03-no-copia.png")


def c5():
    out = ch("05-todo-a-partir-de-dibujos")
    c = C(860, 280)
    c.text(430, 22, "Estallido de cuadrado", size=18, bold=True)
    # cuadrado: 1 verde arriba-izq, 2 rojo arriba-der, 3 rojo abajo-izq, 4 verde abajo-der
    c.spider(150, 80, GREEN, r=16)
    c.spider(250, 80, RED, r=16)
    c.spider(150, 170, RED, r=16)
    c.spider(250, 170, GREEN, r=16)
    c.line([(166, 80), (234, 80)])
    c.line([(166, 170), (234, 170)])
    c.line([(150, 96), (150, 154)])
    c.line([(250, 96), (250, 154)])
    c.line([(150, 64), (110, 45)])
    c.line([(250, 64), (290, 45)])
    c.line([(150, 186), (110, 210)])
    c.line([(250, 186), (290, 210)])
    c.text(100, 40, "1", size=14, fill=GREEN, bold=True)
    c.text(300, 40, "2", size=14, fill=RED, bold=True)
    c.text(100, 215, "3", size=14, fill=RED, bold=True)
    c.text(300, 215, "4", size=14, fill=GREEN, bold=True)
    c.eq(390, 125)

    # resultado: verde a la izquierda, rojo a la derecha, comparten pata
    # 1 (verde) va al rojo, 2 (rojo) va al verde, 3 (rojo) va al verde, 4 (verde) va al rojo
    c.spider(560, 125, GREEN, r=16)
    c.spider(640, 125, RED, r=16)
    c.line([(576, 125), (624, 125)])
    c.line([(560, 109), (500, 55)])   # pata 2, etiqueta roja, al verde
    c.line([(640, 109), (700, 50)])   # pata 1, etiqueta verde, al rojo
    c.line([(545, 140), (500, 200)])  # pata 3 al verde
    c.line([(655, 140), (710, 200)])  # pata 4 al rojo
    c.text(490, 48, "2", size=14, fill=RED, bold=True)
    c.text(710, 42, "1", size=14, fill=GREEN, bold=True)
    c.text(490, 210, "3", size=14, fill=RED, bold=True)
    c.text(720, 205, "4", size=14, fill=GREEN, bold=True)
    c.text(430, 255, "cada pata exterior vuelve al color opuesto a su etiqueta", size=14, fill=MUTED)
    c.save(out / "01-estallido.png")

    c = C(980, 320)
    c.text(490, 20, "Tres CNOT de colores alternados", size=18, bold=True)

    def ladder(x, y, n=3):
        colors = [(GREEN, RED), (RED, GREEN), (GREEN, RED)]
        for i in range(n):
            yy = y + i * 52
            a, b = colors[i]
            c.spider(x, yy, a, r=13)
            c.spider(x + 70, yy, b, r=13)
            c.line([(x + 13, yy), (x + 57, yy)])
            if i < n - 1:
                c.wire(x, yy + 13, yy + 39)
                c.wire(x + 70, yy + 13, yy + 39)
        c.wire(x, y - 28, y - 13)
        c.wire(x + 70, y - 28, y - 13)
        c.wire(x, y + 2 * 52 + 13, y + 2 * 52 + 36)
        c.wire(x + 70, y + 2 * 52 + 13, y + 2 * 52 + 36)

    ladder(80, 70)
    c.text(115, 290, "1. tres CNOT", size=13, fill=MUTED)
    c.text(230, 140, "estallido →", size=13, fill=MUTED, anchor="lm")

    # después del estallido: cruce arriba y dos CNOT abajo, esquema del resultado intermedio
    c.line([(360, 55), (430, 100)])
    c.line([(430, 55), (360, 100)])
    c.spider(360, 130, GREEN, r=13)
    c.spider(430, 130, RED, r=13)
    c.line([(373, 130), (417, 130)])
    c.wire(360, 143, 175)
    c.wire(430, 143, 175)
    c.spider(360, 190, GREEN, r=13)
    c.spider(430, 190, RED, r=13)
    c.line([(373, 190), (417, 190)])
    c.wire(360, 203, 235)
    c.wire(430, 203, 235)
    c.text(395, 290, "2. tras el estallido", size=13, fill=MUTED)

    c.text(500, 140, "fusión y corte →", size=13, fill=MUTED, anchor="lm")
    c.line([(620, 70), (700, 200)])
    c.line([(700, 70), (620, 200)])
    c.text(660, 290, "3. intercambio", size=13, fill=MUTED)
    c.text(490, 305, "no es un solo paso: estallido, fusión, corte de patas", size=13, fill=MUTED)
    c.save(out / "02-tres-cnot.png")

    c = C(860, 200)
    c.text(430, 22, "Última regla", size=18, bold=True)
    xs = [80, 180, 280]
    cols = [RED, GREEN, RED]
    phases = ["α", "β", "γ"]
    c.wire(40, 100, 100)
    c.line([(40, 100), (xs[0] - 22, 100)])
    for i, (x, col, ph) in enumerate(zip(xs, cols, phases)):
        c.spider(x, 100, col, ph, r=22)
        if i:
            c.line([(xs[i - 1] + 22, 100), (x - 22, 100)])
    c.line([(xs[-1] + 22, 100), (340, 100)])
    c.eq(400, 100)
    xs2 = [500, 600, 700]
    cols2 = [GREEN, RED, GREEN]
    phases2 = ["α'", "β'", "γ'"]
    c.line([(430, 100), (xs2[0] - 22, 100)])
    for i, (x, col, ph) in enumerate(zip(xs2, cols2, phases2)):
        c.spider(x, 100, col, ph, r=22)
        if i:
            c.line([(xs2[i - 1] + 22, 100), (x - 22, 100)])
    c.line([(xs2[-1] + 22, 100), (790, 100)])
    c.text(430, 165, "α', β', γ' las fijan las matrices. No se eligen.", size=14, fill=MUTED)
    c.save(out / "03-ultima-regla.png")


def c6():
    out = ch("06-probabilidades")
    c = C(900, 230)
    c.text(450, 22, "La taza sin número no es segura", size=18, bold=True)
    c.discard(78, 62)
    c.discard(142, 62)
    c.double(78, 80, 108)
    c.double(142, 80, 108)
    c.cup(70, 108, 80, 48)
    c.cup(76, 108, 68, 40)
    c.eq(230, 110)
    c.spider(320, 110, GREEN, r=16)
    c.eq(400, 110)
    c.text(470, 110, "2", size=28, bold=True)
    c.neq(560, 110)
    c.d.rounded_rectangle([c.s(620), c.s(80), c.s(700), c.s(145)], radius=8 * SCALE, outline=MUTED, width=2)
    c.text(660, 112, "vacío", size=14, fill=MUTED)
    c.text(450, 200, "descartar la taza cuántica deja la araña verde sin patas, que vale 2", size=14, fill=MUTED)
    c.save(out / "01-trampa.png")

    c = C(860, 220)
    c.text(430, 22, "El un medio cancela el dos", size=18, bold=True)
    c.text(70, 110, "1/2", size=22, bold=True)
    c.spider(140, 110, GREEN, r=16)
    c.eq(230, 110)
    c.d.rounded_rectangle([c.s(300), c.s(80), c.s(380), c.s(145)], radius=8 * SCALE, outline=MUTED, width=2)
    c.text(340, 112, "vacío", size=14, fill=MUTED)
    c.text(470, 95, "1/2", size=20, bold=True)
    c.line([(530, 70), (530, 100)])
    c.line([(610, 70), (610, 100)])
    c.cup(530, 100, 80, 42)
    c.cup(536, 100, 68, 34)
    c.text(620, 175, "taza cuántica segura", size=14, fill=MUTED)
    c.save(out / "02-un-medio.png")


def c7():
    out = ch("07-nombres-profesionales")
    c = C(980, 220)
    c.text(490, 22, "La notación, con el nombre del libro", size=18, bold=True)
    items = [
        (70, "hilo", "wire"),
        (190, "araña Z", "spider"),
        (320, "araña X", "spider"),
        (450, "cambio de color", "hbox"),
        (600, "descarte", "discard"),
        (740, "taza", "cup"),
        (880, "ruido", "noise"),
    ]
    for x, label, kind in items:
        y = 100
        if kind == "wire":
            c.wire(x, 60, 140)
        elif kind == "spider" and "Z" in label:
            c.spider(x, 100, GREEN, r=16)
        elif kind == "spider":
            c.spider(x, 100, RED, r=16)
        elif kind == "hbox":
            c.hbox(x, 100, s=16)
            c.wire(x, 70, 84)
            c.wire(x, 116, 140)
        elif kind == "discard":
            c.wire(x, 150, 125)
            c.discard(x, 125)
        elif kind == "cup":
            c.cup(x - 30, 80, 60, 40)
            c.line([(x - 30, 80), (x - 30, 65)])
            c.line([(x + 30, 80), (x + 30, 65)])
        elif kind == "noise":
            c.noise(x, 120)
            c.wire(x, 102, 65)
        c.text(x, 185, label, size=13, fill=MUTED)
    c.save(out / "01-leyenda.png")


if __name__ == "__main__":
    c1()
    c2()
    c3()
    c4()
    c5()
    c6()
    c7()
    print("ok")
