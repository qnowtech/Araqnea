"""Dibujo de circuitos con el estilo de los resúmenes.

Verde es la familia Z, rojo la familia X, ámbar es Hadamard.
El tiempo del diagrama va de izquierda a derecha.
"""

from __future__ import annotations

import io
import warnings
from dataclasses import dataclass
from pathlib import Path

import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from qiskit import QuantumCircuit
from qiskit.quantum_info import Operator, Statevector

warnings.filterwarnings("ignore", message="The encoding cp1252")

LIBRO = Path(__file__).resolve().parents[1]
CAPITULOS = LIBRO / "chapters"

VERDE = "#2E9E3A"
ROJO = "#D6362F"
AMBAR = "#C47B2B"
TINTA = "#1C1C1C"
APAGADO = "#5C6570"
PAPEL = (255, 255, 255)

ESTILO = {
    "name": "textbook",
    "backgroundcolor": "#FFFFFF",
    "textcolor": TINTA,
    "linecolor": TINTA,
    "creglinecolor": "#5C6B73",
    "fontsize": 13,
    "subfontsize": 11,
    "dpi": 160,
    "margin": [2.0, 0.35, 0.2, 0.25],
    "displaycolor": {
        "z": [VERDE, "#FFFFFF"],
        "s": [VERDE, "#FFFFFF"],
        "sdg": [VERDE, "#FFFFFF"],
        "t": [VERDE, "#FFFFFF"],
        "tdg": [VERDE, "#FFFFFF"],
        "rz": [VERDE, "#FFFFFF"],
        "p": [VERDE, "#FFFFFF"],
        "cz": [VERDE, "#FFFFFF"],
        "x": [ROJO, "#FFFFFF"],
        "y": [ROJO, "#FFFFFF"],
        "rx": [ROJO, "#FFFFFF"],
        "cx": [TINTA, "#FFFFFF"],
        "sx": [ROJO, "#FFFFFF"],
        "h": [AMBAR, "#FFFFFF"],
        "ry": ["#3D5A80", "#FFFFFF"],
        "swap": [TINTA, "#FFFFFF"],
        "id": [APAGADO, "#FFFFFF"],
        "measure": ["#3E4A54", "#FFFFFF"],
    },
}


def _fuente(tamano, negrita=False):
    nombre = "segoeuib.ttf" if negrita else "segoeui.ttf"
    ruta = Path(r"C:\Windows\Fonts") / nombre
    if not ruta.exists():
        nombre = "arialbd.ttf" if negrita else "arial.ttf"
        ruta = Path(r"C:\Windows\Fonts") / nombre
    return ImageFont.truetype(str(ruta), tamano)


def mismas_matrices(izquierda, derecha):
    a = Operator(izquierda).data
    b = Operator(derecha).data
    if not np.allclose(a, b):
        raise AssertionError("las dos matrices no coinciden")


def mismos_estados(izquierda, derecha):
    a = Statevector.from_instruction(izquierda).data
    b = Statevector.from_instruction(derecha).data
    if not np.allclose(a, b):
        raise AssertionError("los dos estados no coinciden")


def estados_distintos(izquierda, derecha):
    a = Statevector.from_instruction(izquierda).data
    b = Statevector.from_instruction(derecha).data
    if np.allclose(a, b):
        raise AssertionError("los dos estados coinciden")


def vacio(qubits):
    return QuantumCircuit(qubits)


@dataclass
class Panel:
    circuito: QuantumCircuit
    pie: str = ""
    inicial: bool = False


@dataclass
class Fila:
    paneles: list[Panel]
    signo: str = ""


def _render(panel: Panel) -> Image.Image:
    figura = panel.circuito.draw(
        output="mpl",
        style=ESTILO,
        fold=-1,
        scale=1.15,
        justify="left",
        initial_state=panel.inicial,
        plot_barriers=True,
        cregbundle=True,
        vertical_compression="medium",
    )
    try:
        bufer = io.BytesIO()
        figura.savefig(
            bufer,
            format="png",
            dpi=ESTILO["dpi"],
            bbox_inches="tight",
            pad_inches=0.06,
            facecolor="white",
        )
        bufer.seek(0)
        imagen = Image.open(bufer).convert("RGB")
        imagen.load()
    finally:
        plt.close(figura)
    return _recortar(imagen)


def _recortar(imagen: Image.Image, margen=10) -> Image.Image:
    pixels = np.asarray(imagen)
    tinta = np.any(pixels < 248, axis=2)
    ys, xs = np.where(tinta)
    if len(xs) == 0:
        return imagen
    izquierda = max(0, int(xs.min()) - margen)
    arriba = max(0, int(ys.min()) - margen)
    derecha = min(imagen.width, int(xs.max()) + margen + 1)
    abajo = min(imagen.height, int(ys.max()) + margen + 1)
    return imagen.crop((izquierda, arriba, derecha, abajo))


def _ancho(dibujo, texto, fuente):
    if not texto:
        return 0
    return int(dibujo.textlength(texto, font=fuente))


def figura(filas: list[Fila], titulo: str, ruta: Path, pie: str = ""):
    fuente_titulo = _fuente(26, negrita=True)
    fuente_pie = _fuente(16)
    fuente_signo = _fuente(34, negrita=True)
    fuente_caption = _fuente(15)

    filas_listas = []
    for fila in filas:
        paneles = []
        for panel in fila.paneles:
            imagen = _render(panel)
            paneles.append((imagen, panel.pie))
        filas_listas.append((fila.signo, paneles))

    sonda = ImageDraw.Draw(Image.new("RGB", (8, 8), PAPEL))
    hueco_signo = 72
    hueco_suelto = 64
    alturas = []
    anchos = []
    for signo, paneles in filas_listas:
        anchos_panel = []
        alto_circuitos = 0
        hay_caption = False
        for imagen, caption in paneles:
            anchos_panel.append(max(imagen.width, _ancho(sonda, caption, fuente_caption) + 8))
            alto_circuitos = max(alto_circuitos, imagen.height)
            hay_caption = hay_caption or bool(caption)
        alto = alto_circuitos + (32 if hay_caption else 0)
        ancho = sum(anchos_panel)
        if len(paneles) > 1:
            ancho += (len(paneles) - 1) * (hueco_signo if signo else hueco_suelto)
        alturas.append((alto, alto_circuitos, hay_caption, anchos_panel))
        anchos.append(ancho)

    margen = 28 if titulo or pie else 16
    alto_titulo = 58 if titulo else 8
    alto_pie = 46 if pie else 8
    separacion = 26
    ancho_texto = max(_ancho(sonda, titulo, fuente_titulo), _ancho(sonda, pie, fuente_pie))
    ancho_total = max([ancho_texto, *anchos]) + margen * 2
    alto_total = alto_titulo + sum(a[0] for a in alturas) + separacion * (len(filas_listas) - 1) + alto_pie

    lienzo = Image.new("RGB", (ancho_total, alto_total), PAPEL)
    dibujo = ImageDraw.Draw(lienzo)
    y = 18 if titulo else 8
    if titulo:
        dibujo.text((ancho_total / 2, y + 8), titulo, font=fuente_titulo, fill=TINTA, anchor="mt")
    y = alto_titulo

    for (signo, paneles), (alto, alto_circuitos, hay_caption, anchos_panel), ancho_fila in zip(
        filas_listas, alturas, anchos
    ):
        x = (ancho_total - ancho_fila) // 2
        for indice, ((imagen, caption), ancho_panel) in enumerate(zip(paneles, anchos_panel)):
            dibujo_y = y + (alto_circuitos - imagen.height) // 2
            lienzo.paste(imagen, (x + (ancho_panel - imagen.width) // 2, dibujo_y))
            if caption:
                dibujo.text(
                    (x + ancho_panel / 2, y + alto_circuitos + 16),
                    caption,
                    font=fuente_caption,
                    fill=APAGADO,
                    anchor="mt",
                )
            x += ancho_panel
            if indice < len(paneles) - 1:
                if signo:
                    dibujo.text(
                        (x + hueco_signo / 2, y + alto_circuitos / 2),
                        signo,
                        font=fuente_signo,
                        fill=TINTA,
                        anchor="mm",
                    )
                    x += hueco_signo
                else:
                    x += hueco_suelto
        y += alto + separacion

    if pie:
        dibujo.text((ancho_total / 2, alto_total - 22), pie, font=fuente_pie, fill=APAGADO, anchor="mm")

    ruta = Path(ruta)
    ruta.parent.mkdir(parents=True, exist_ok=True)
    lienzo.save(ruta, "PNG")


def destino(capitulo: str, nombre: str) -> Path:
    return CAPITULOS / capitulo / "img" / "circuitos" / nombre


def pieza(circuito: QuantumCircuit, etiqueta: str, ruta: Path, inicial: bool = False):
    """Un circuito, el de una sola subimagen. Sin título y sin juntar piezas."""
    figura([Fila([Panel(circuito, etiqueta, inicial=inicial)])], "", ruta)
