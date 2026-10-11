"""Circuitos del capítulo 4, Partículas cuánticas y ordinarias."""

from qiskit import ClassicalRegister, QuantumCircuit, QuantumRegister

from estilo import Fila, Panel, destino, estados_distintos, figura, pieza

CAPITULO = "04-particulas-cuanticas-y-ordinarias"


def generar():
    medida = QuantumCircuit(1, 1)
    medida.measure(0, 0)

    bit = ClassicalRegister(1, "c")
    qubit = QuantumRegister(1, "q")
    codificar = QuantumCircuit(qubit, bit)
    with codificar.if_test((bit[0], 1)):
        codificar.x(qubit[0])

    origen = QuantumRegister(1, "q")
    destino_q = QuantumRegister(1, "r")
    clasico = ClassicalRegister(1, "c")
    ida_y_vuelta = QuantumCircuit(origen, destino_q, clasico)
    ida_y_vuelta.measure(origen[0], clasico[0])
    with ida_y_vuelta.if_test((clasico[0], 1)):
        ida_y_vuelta.x(destino_q[0])

    pieza(medida, "medición", destino(CAPITULO, "4.1 Medición.png"))
    pieza(codificar, "codificación", destino(CAPITULO, "4.2 Codificación.png"), inicial=True)
    pieza(ida_y_vuelta, "borrado de fase", destino(CAPITULO, "4.4 Borrado.png"), inicial=True)
    figura(
        [
            Fila([Panel(medida, "medición")]),
            Fila([Panel(codificar, "codificación", inicial=True)]),
            Fila([Panel(ida_y_vuelta, "medir y volver a codificar", inicial=True)]),
        ],
        "Medición y codificación",
        destino(CAPITULO, "01-medicion.png"),
        "El hilo doble es el ordinario. Medir y codificar copia el bit; la fase del qubit no pasa.",
    )

    ordinaria = QuantumCircuit(2)
    ordinaria.cx(0, 1)
    cuantica = QuantumCircuit(2)
    cuantica.h(0)
    cuantica.cx(0, 1)
    estados_distintos(ordinaria, cuantica)
    figura(
        [
            Fila(
                [
                    Panel(ordinaria, "CNOT desde |00>", inicial=True),
                    Panel(cuantica, "taza cuántica", inicial=True),
                ],
                "≠",
            )
        ],
        "Dos tazas",
        destino(CAPITULO, "02-tazas.png"),
        "Sin la H, el CNOT deja |00>. Con la H prepara el estado de Bell.",
    )

    fundida = QuantumCircuit(2)
    fundida.h(0)
    fundida.cx(0, 1)
    copias = QuantumCircuit(2)
    copias.h(0)
    copias.h(1)
    estados_distintos(fundida, copias)
    figura(
        [
            Fila(
                [
                    Panel(fundida, "una sola taza", inicial=True),
                    Panel(copias, "dos estados |+>", inicial=True),
                ],
                "≠",
            )
        ],
        "Fundir no es copiar",
        destino(CAPITULO, "03-no-copia.png"),
        "H y CNOT no parten el |+> en dos. No hay un circuito que copie todos los estados.",
    )
