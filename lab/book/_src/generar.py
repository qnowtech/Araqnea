"""Dibuja los circuitos de los resúmenes.

Desde lab/book, con el entorno ya creado:

    .venv\\Scripts\\python _src\\generar.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from c01_hilos import generar as hilos
from c02_aranas import generar as aranas
from c03_einstein import generar as einstein
from c04_particulas import generar as particulas
from c05_dibujos import generar as dibujos
from c06_probabilidades import generar as probabilidades
from c07_nombres import generar as nombres


def main():
    hilos()
    aranas()
    einstein()
    particulas()
    dibujos()
    probabilidades()
    nombres()
    print("circuitos escritos")


if __name__ == "__main__":
    main()
