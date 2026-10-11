"""Circuitos del capítulo 3, Mantener contento a Einstein."""

from qiskit import ClassicalRegister, QuantumCircuit, QuantumRegister

from estilo import Fila, Panel, destino, figura, pieza

CAPITULO = "03-mantener-contento-a-einstein"


def generar():
    frontera = QuantumCircuit(1, 1)
    frontera.measure(0, 0)
    figura(
        [Fila([Panel(frontera, "la frontera de medida")])],
        "Medición",
        destino(CAPITULO, "01-frontera.png"),
        "La medición guarda un bit en el hilo doble. El descarte del libro tira el qubit y no guarda ese bit.",
    )

    hadamard = QuantumCircuit(1)
    hadamard.h(0)
    cnot = QuantumCircuit(2)
    cnot.cx(0, 1)
    figura(
        [Fila([Panel(hadamard, "H"), Panel(cnot, "CNOT")])],
        "Cajas seguras",
        destino(CAPITULO, "02-caja-segura.png"),
        "Una unitaria es segura: descartar todas las salidas es descartar todas las entradas.",
    )

    por_separado = QuantumCircuit(2, 2)
    por_separado.measure(0, 0)
    por_separado.measure(1, 1)
    tapa = QuantumCircuit(2, 2)
    tapa.cx(0, 1)
    tapa.h(0)
    tapa.measure(0, 0)
    tapa.measure(1, 1)
    pieza(por_separado, "un test en cada hilo", destino(CAPITULO, "3.1 Suma.png"))
    pieza(tapa, "la tapa", destino(CAPITULO, "3.2 Tapa.png"))
    figura(
        [
            Fila(
                [
                    Panel(por_separado, "un test en cada hilo"),
                    Panel(tapa, "la tapa, los dos hilos juntos"),
                ],
                "≠",
            )
        ],
        "La tapa no es medir por separado",
        destino(CAPITULO, "03-tests.png"),
        "Medir cada qubit en Z junta el test de 0° con el de 180°. La tapa pregunta otra cosa.",
    )

    psi = QuantumRegister(1, "psi")
    andrea = QuantumRegister(1, "A")
    blaise = QuantumRegister(1, "B")
    aviso = ClassicalRegister(2, "aviso")
    telefono = QuantumCircuit(psi, andrea, blaise, aviso)
    telefono.h(andrea[0])
    telefono.cx(andrea[0], blaise[0])
    telefono.barrier()
    telefono.cx(psi[0], andrea[0])
    telefono.h(psi[0])
    telefono.measure(psi[0], aviso[0])
    telefono.measure(andrea[0], aviso[1])
    telefono.barrier()
    with telefono.if_test((aviso[1], 1)):
        telefono.x(blaise[0])
    with telefono.if_test((aviso[0], 1)):
        telefono.z(blaise[0])
    figura(
        [Fila([Panel(telefono, "el aviso viaja por el hilo doble")])],
        "El teléfono",
        destino(CAPITULO, "04-telefono.png"),
        "La taza va de A a B. La tapa cae sobre psi y A. El bit del aviso corrige a B, y el protocolo ocurre siempre.",
    )
