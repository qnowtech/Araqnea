"""Circuitos del capítulo 7, con el nombre que usa la profesión."""

import numpy as np
from qiskit import QuantumCircuit

from estilo import Fila, Panel, destino, figura

CAPITULO = "07-nombres-profesionales"


def generar():
    hilo = QuantumCircuit(1)
    zeta = QuantumCircuit(1)
    zeta.rz(np.pi / 2, 0)
    equis = QuantumCircuit(1)
    equis.x(0)
    hadamard = QuantumCircuit(1)
    hadamard.h(0)
    medida = QuantumCircuit(1, 1)
    medida.measure(0, 0)
    bell = QuantumCircuit(2)
    bell.h(0)
    bell.cx(0, 1)
    intercambio = QuantumCircuit(2)
    intercambio.swap(0, 1)

    figura(
        [
            Fila(
                [
                    Panel(hilo, "identidad"),
                    Panel(zeta, "rotación Z"),
                    Panel(equis, "puerta X"),
                    Panel(hadamard, "Hadamard"),
                ]
            ),
            Fila(
                [
                    Panel(medida, "medición"),
                    Panel(bell, "estado de Bell", inicial=True),
                    Panel(intercambio, "SWAP"),
                ]
            ),
        ],
        "En el diagrama de circuitos",
        destino(CAPITULO, "01-leyenda.png"),
        "Verde es Z, rojo es X, ámbar es Hadamard. El hilo doble de la medición es el hilo ordinario.",
    )
