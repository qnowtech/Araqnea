"""Circuitos del capítulo 1, Hilos y cajas."""

import numpy as np
from qiskit import ClassicalRegister, QuantumCircuit, QuantumRegister

from estilo import Fila, Panel, destino, figura, mismas_matrices, mismos_estados, pieza, vacio

CAPITULO = "01-hilos-y-cajas"


def generar():
    hilo = vacio(1)
    caja = QuantumCircuit(1)
    caja.h(0)
    estado = QuantumCircuit(1)
    estado.h(0)
    test = QuantumCircuit(1, 1)
    test.measure(0, 0)
    numero = QuantumCircuit(1, 1)
    numero.h(0)
    numero.measure(0, 0)
    taza = QuantumCircuit(2)
    taza.h(0)
    taza.cx(0, 1)
    tapa = QuantumCircuit(2, 2)
    tapa.cx(0, 1)
    tapa.h(0)
    tapa.measure(0, 0)
    tapa.measure(1, 1)

    pieza(hilo, "hilo", destino(CAPITULO, "1.1 Hilo.png"))
    pieza(caja, "caja", destino(CAPITULO, "1.2 Caja.png"))
    pieza(estado, "estado", destino(CAPITULO, "1.3 Estado.png"), inicial=True)
    pieza(test, "test", destino(CAPITULO, "1.4 Test.png"))
    pieza(numero, "número", destino(CAPITULO, "1.5 Número.png"), inicial=True)
    pieza(taza, "taza", destino(CAPITULO, "1.6 Taza.png"), inicial=True)
    pieza(tapa, "tapa", destino(CAPITULO, "1.7 Tapa.png"))

    tiron = QuantumCircuit(2)
    tiron.h(0)
    tiron.cx(0, 1)
    tiron.cx(0, 1)
    tiron.h(0)
    mismas_matrices(tiron, vacio(2))
    figura(
        [Fila([Panel(tiron, "preparar y deshacer"), Panel(vacio(2), "hilo")], "=")],
        "Tirón",
        destino(CAPITULO, "03-tiron.png"),
        "En compuertas el lazo se endereza del todo: las dos H y los dos CNOT se cancelan.",
    )

    angulo = np.pi / 3
    izquierda = QuantumCircuit(2)
    izquierda.h(0)
    izquierda.cx(0, 1)
    izquierda.ry(angulo, 0)
    derecha = QuantumCircuit(2)
    derecha.h(0)
    derecha.cx(0, 1)
    derecha.ry(-angulo, 1)
    mismos_estados(izquierda, derecha)
    figura(
        [
            Fila(
                [
                    Panel(izquierda, "la caja en la pata izquierda", inicial=True),
                    Panel(derecha, "su transpuesta en la otra", inicial=True),
                ],
                "=",
            )
        ],
        "Deslizamiento",
        destino(CAPITULO, "04-deslizamiento.png"),
        "RY(π/3) cruzando el doblez sale como RY(−π/3). Esa es la transpuesta.",
    )

    despues = QuantumCircuit(1)
    despues.s(0)
    despues.sdg(0)
    antes = QuantumCircuit(1)
    antes.sdg(0)
    antes.s(0)
    hadamard = QuantumCircuit(1)
    hadamard.h(0)
    hadamard.h(0)
    mismas_matrices(despues, vacio(1))
    mismas_matrices(antes, vacio(1))
    mismas_matrices(hadamard, vacio(1))
    figura(
        [
            Fila([Panel(hadamard, "H y luego H"), Panel(vacio(1), "hilo")], "="),
            Fila([Panel(despues, "S y luego su volteo"), Panel(vacio(1), "hilo")], "="),
            Fila([Panel(antes, "el volteo y luego S"), Panel(vacio(1), "hilo")], "="),
        ],
        "Volteo",
        destino(CAPITULO, "05-volteo.png"),
        "H es su propio volteo. El volteo de S es S†, y las dos órdenes devuelven el hilo.",
    )

    a = QuantumRegister(1, "A")
    c = QuantumRegister(1, "C")
    d = QuantumRegister(1, "D")
    b = QuantumRegister(1, "B")
    medida = ClassicalRegister(2, "m")
    fusion = QuantumCircuit(a, c, d, b, medida)
    fusion.h(a[0])
    fusion.cx(a[0], c[0])
    fusion.h(d[0])
    fusion.cx(d[0], b[0])
    fusion.barrier()
    fusion.cx(c[0], d[0])
    fusion.h(c[0])
    fusion.measure(c[0], medida[0])
    fusion.measure(d[0], medida[1])
    figura(
        [Fila([Panel(fusion, "dos tazas y una tapa en medio", inicial=True)])],
        "Fusión de tazas",
        destino(CAPITULO, "06-fusion-tazas.png"),
        "Si la medición de Bell en C y D da 00, A y B quedan compartiendo la taza.",
    )
