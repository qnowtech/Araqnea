"""Circuitos del capítulo 6, Probabilidades a partir de dibujos."""

from qiskit import QuantumCircuit

from estilo import Fila, Panel, destino, figura

CAPITULO = "06-probabilidades"


def generar():
    taza = QuantumCircuit(2)
    taza.h(0)
    taza.cx(0, 1)
    figura(
        [Fila([Panel(taza, "taza cuántica segura", inicial=True)])],
        "El un medio ya está en H",
        destino(CAPITULO, "02-un-medio.png"),
        "Este circuito prepara (|00> + |11>) / raíz de dos. Descartarlo da probabilidad 1.",
    )

    cnot = QuantumCircuit(2)
    cnot.cx(0, 1)
    figura(
        [Fila([Panel(cnot, "CNOT")])],
        "Una caja que ya trae su número",
        destino(CAPITULO, "03-cnot.png"),
        "El CNOT del circuito es unitario. La araña sin el número, al descartarla, todavía no lo es.",
    )
