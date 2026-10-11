"""Circuitos del capítulo 5, Todo a partir de dibujos."""

from qiskit import QuantumCircuit
from qiskit.quantum_info import Operator
from qiskit.synthesis import OneQubitEulerDecomposer

from estilo import Fila, Panel, destino, figura, mismas_matrices

CAPITULO = "05-todo-a-partir-de-dibujos"


def generar():
    escalera = QuantumCircuit(2)
    escalera.cx(0, 1)
    escalera.cx(1, 0)
    escalera.cx(0, 1)
    intercambio = QuantumCircuit(2)
    intercambio.swap(0, 1)
    mismas_matrices(escalera, intercambio)
    figura(
        [
            Fila(
                [
                    Panel(escalera, "tres CNOT, colores alternados"),
                    Panel(intercambio, "intercambio"),
                ],
                "=",
            )
        ],
        "Tres CNOT",
        destino(CAPITULO, "02-tres-cnot.png"),
        "El estallido, la fusión y el corte de patas dejan el SWAP. No es una compuerta nueva.",
    )

    hadamard = Operator.from_label("H")
    verde_rojo_verde = OneQubitEulerDecomposer("ZXZ")(hadamard)
    rojo_verde_rojo = OneQubitEulerDecomposer("XZX")(hadamard)
    mismas_matrices(verde_rojo_verde, rojo_verde_rojo)
    figura(
        [
            Fila(
                [
                    Panel(verde_rojo_verde, "verde, roja, verde"),
                    Panel(rojo_verde_rojo, "roja, verde, roja"),
                ],
                "=",
            )
        ],
        "Última regla",
        destino(CAPITULO, "03-ultima-regla.png"),
        "Las dos ternas son H. La fase global π/2 es el número de la regla, y es la misma a los dos lados.",
    )
