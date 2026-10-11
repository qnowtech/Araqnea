"""Circuitos del capítulo 2, Un mundo de arañas."""

from qiskit import QuantumCircuit

from estilo import (
    Fila,
    Panel,
    destino,
    estados_distintos,
    figura,
    mismas_matrices,
    mismos_estados,
    pieza,
    vacio,
)

CAPITULO = "02-un-mundo-de-aranas"


def generar():
    dos_s = QuantumCircuit(1)
    dos_s.s(0)
    dos_s.s(0)
    zeta = QuantumCircuit(1)
    zeta.z(0)
    mismas_matrices(dos_s, zeta)
    figura(
        [Fila([Panel(dos_s, "90° y otra vez 90°"), Panel(zeta, "180°")], "=")],
        "Fusión",
        destino(CAPITULO, "01-fusion.png"),
        "Las dos son arañas verdes. 90° + 90° = 180°, módulo 360°.",
    )

    fase = QuantumCircuit(1)
    fase.s(0)
    volteada = QuantumCircuit(1)
    volteada.sdg(0)
    figura(
        [Fila([Panel(fase, "fase 90°"), Panel(volteada, "fase 270°")], "→")],
        "Volteo de una fase",
        destino(CAPITULO, "07-volteo-fase.png"),
        "El volteo vertical lleva α a 360° − α. S† es la fase −90°, que es 270°.",
    )

    identidad = QuantumCircuit(1)
    identidad.id(0)
    taza = QuantumCircuit(2)
    taza.h(0)
    taza.cx(0, 1)
    tapa = QuantumCircuit(2, 2)
    tapa.cx(0, 1)
    tapa.h(0)
    tapa.measure(0, 0)
    tapa.measure(1, 1)
    mismas_matrices(identidad, vacio(1))
    pieza(identidad, "hilo", destino(CAPITULO, "2.1 Hilo.png"))
    pieza(taza, "taza", destino(CAPITULO, "2.2 Taza.png"), inicial=True)
    pieza(tapa, "tapa", destino(CAPITULO, "2.3 Tapa.png"))
    figura(
        [
            Fila([Panel(identidad, "fase 0°, una entrada y una salida"), Panel(vacio(1), "hilo")], "="),
            Fila([Panel(taza, "fase 0°, dos salidas", inicial=True)]),
            Fila([Panel(tapa, "fase 0°, dos entradas")]),
        ],
        "Fase 0°",
        destino(CAPITULO, "02-patas-cero.png"),
        "La de dos salidas es la taza del ordenador. La de dos entradas es la medición de Bell.",
    )

    dos = QuantumCircuit(2)
    dos.cx(0, 1)
    dos.cx(0, 1)
    tres = QuantumCircuit(2)
    tres.cx(0, 1)
    tres.cx(0, 1)
    tres.cx(0, 1)
    uno = QuantumCircuit(2)
    uno.cx(0, 1)
    mismas_matrices(dos, vacio(2))
    mismas_matrices(tres, uno)
    figura(
        [
            Fila([Panel(dos, "dos patas"), Panel(vacio(2), "ninguna")], "="),
            Fila([Panel(tres, "tres patas"), Panel(uno, "queda una")], "="),
        ],
        "Corte de patas",
        destino(CAPITULO, "03-corte-patas.png"),
        "CNOT seguido de CNOT funde las arañas y el corte se lleva el par. Tres CNOT dejan uno.",
    )

    copia = QuantumCircuit(2)
    copia.x(0)
    copia.cx(0, 1)
    separados = QuantumCircuit(2)
    separados.x(0)
    separados.x(1)
    mismos_estados(copia, separados)
    no_copia = QuantumCircuit(2)
    no_copia.h(0)
    no_copia.cx(0, 1)
    dos_mas = QuantumCircuit(2)
    dos_mas.h(0)
    dos_mas.h(1)
    estados_distintos(no_copia, dos_mas)
    figura(
        [
            Fila(
                [
                    Panel(copia, "la roja de 180° entra en el CNOT", inicial=True),
                    Panel(separados, "dos copias de esa roja", inicial=True),
                ],
                "=",
            ),
            Fila(
                [
                    Panel(no_copia, "la verde de 0° entra en el CNOT", inicial=True),
                    Panel(dos_mas, "dos verdes separadas", inicial=True),
                ],
                "≠",
            ),
        ],
        "Copia",
        destino(CAPITULO, "04-copia.png"),
        "El CNOT copia el |1>, que es araña roja. No copia el |+>, que es araña verde.",
    )

    color = QuantumCircuit(1)
    color.h(0)
    color.z(0)
    color.h(0)
    equis = QuantumCircuit(1)
    equis.x(0)
    doble_h = QuantumCircuit(1)
    doble_h.h(0)
    doble_h.h(0)
    empujar = QuantumCircuit(1)
    empujar.h(0)
    empujar.z(0)
    empujada = QuantumCircuit(1)
    empujada.x(0)
    empujada.h(0)
    mismas_matrices(color, equis)
    mismas_matrices(doble_h, vacio(1))
    mismas_matrices(empujar, empujada)
    figura(
        [
            Fila([Panel(color, "H en las dos patas"), Panel(equis, "la araña cambió de color")], "="),
            Fila([Panel(doble_h, "dos cajas seguidas"), Panel(vacio(1), "hilo")], "="),
            Fila([Panel(empujar, "la caja entra por abajo"), Panel(empujada, "sale por arriba")], "="),
        ],
        "Cambio de color",
        destino(CAPITULO, "05-cambio-color.png"),
        "Z verde con H a los dos lados es X roja. Empujar la caja también cambia el color.",
    )

    nota = QuantumCircuit(1)
    nota.x(0)
    cnot = QuantumCircuit(2)
    cnot.cx(0, 1)
    pieza(nota, "NOT", destino(CAPITULO, "2.4 NOT.png"))
    pieza(cnot, "CNOT", destino(CAPITULO, "2.5 CNOT.png"))
    figura(
        [Fila([Panel(nota, "NOT, araña roja de 180°"), Panel(cnot, "CNOT")])],
        "Puertas",
        destino(CAPITULO, "06-puertas.png"),
        "El control es la araña verde y el blanco es la araña roja. Las dos van a fase 0°.",
    )
