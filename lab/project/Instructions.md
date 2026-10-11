# Backlog

Araqnea guarda un circuito como OpenQASM 2.0 y deriva de él las compuertas y el diagrama. La lógica de ese diagrama es la de `lab/Teoría ZXcalculus.md` y de `lab/book/chapters`: qué pata se conecta con cuál, qué mapa denota y qué número lo acompaña. Mover el trazo en la página no es una regla.

El texto del circuito no cambia al reescribir. `validateSync` sigue comprobando texto, compuertas y arañas derivadas. El diagrama de trabajo es otra copia. `synthesize` vuelve a compuertas solo cuando esa copia tiene una lista única en el diccionario.

Orden de la lógica: BL-0, BL-1, BL-4, BL-3, BL-2. Las casillas son el 10/10. La interfaz queda al final y no redefine ninguna de esas casillas. El rediseño de la vista de arañas es UI-1 y UI-2.

---

# Lógica

## BL-0 — Generadores, hilos y números

`src/lib/zx-core/semantics.ts` es la única tabla de mapas. `translator.ts`, la paleta y `gateInfo.ts` la consultan.

El libro mide las fases en grados y la teoría en radianes. Son el mismo ángulo: 0°, 90°, 180°, 270° y 360° son \(0\), \(\pi/2\), \(\pi\), \(3\pi/2\) y \(0\).

### 10/10

Requisitos

- [x] Una fase es un ángulo en \([0, 2\pi)\). Toda suma se guarda otra vez en ese intervalo. Sin marca, la fase es 0.
- [x] Hay dos colores de araña. Verde y blanco son Z. Rojo y gris son X. No hay un tercer color.
- [x] Hay dos tipos de hilo. El cuántico lleva un cúbit. El ordinario lleva un bit. El descarte y la medida no cambian uno en el otro.
- [x] La araña Z de fase \(\alpha\) denota \(|0\dots 0\rangle\langle 0\dots 0| + e^{i\alpha}|1\dots 1\rangle\langle 1\dots 1|\). La araña X denota el mapa análogo en la base de Hadamard.
- [x] La caja de Hadamard y la arista de Hadamard son el mismo generador. Cada puerta del circuito se dibuja con Z, X y esa caja.
- [x] Cada símbolo de la paleta es uno de esos generadores con una aridad, o un hilo, o el descarte. La taza cuántica desnuda es araña Z de fase 0 y dos salidas: \(|00\rangle+|11\rangle\). La tapa de dos cúbits es esa araña con dos entradas. Copy es araña Z de una entrada y dos salidas. XOR es araña X de dos entradas y una salida.
- [x] \(|0\rangle\) es la araña X de una salida y fase 0. \(|1\rangle\) es la araña X de una salida y fase \(\pi\). \(|+\rangle\) es la araña Z de una salida y fase 0. La frontera de entrada del circuito es \(|0\rangle\).
- [x] El volteo vertical de una araña es la araña de fase \(2\pi-\alpha\). El de una fase de \(\pi/2\) es \(3\pi/2\).
- [x] Un diagrama sin patas es un número. La araña Z sin patas es el número 2. El diagrama vacío es el 1. El \(1/2\) es el inverso de ese 2 y lo cancela cuando se encuentran.
- [x] `swap` no es un generador: son tres CNOT de colores alternados. `y` es X(\(\pi\)) seguida de Z(\(\pi\)), con el escalar \(i\) de \(ZX = iY\).
- [x] La medida guarda un bit en un hilo ordinario. La codificación es su volteo: si el bit es 1, aplica \(X\). El descarte tira el cúbit y no guarda bit. La tapa de dos cúbits no es ese descarte.

Qué esperar

- [x] Identidad, H, S, T, Y, CNOT, CZ, SWAP, Bell y GHZ tienen la misma matriz en el circuito y en el diagrama, número incluido.
- [x] `s` y `rz(π/2)` son la misma araña Z.
- [x] Descartar las dos salidas de la taza desnuda deja el número 2. Descartar el Bell del circuito, el de \(H\) y CNOT, deja 1.
- [x] Cuatro fases \(\pi/4\) sumadas quedan en \(\pi\). Una fase \(-\pi/2\) queda en \(3\pi/2\).

Cómo validar

- [x] Comparar las matrices de esos diez circuitos. Todo nodo es Z, X, Hadamard, hilo, frontera de medida, codificación o descarte.
- [x] El mapa de la taza desnuda es \(|00\rangle+|11\rangle\). El del Bell del circuito es ese vector partido por \(\sqrt{2}\).
- [x] Copy no tiene un caso que copie un estado de fase arbitraria.

---

## BL-1 — El mapa, lo seguro y lo que solo ocurre a veces

`src/lib/zx-core/validate.ts` calcula el mapa y su número. `validateSync` sigue siendo el acuerdo con el OpenQASM. Dos dibujos con las mismas conexiones son el mismo diagrama aunque sus nodos se hayan movido.

Una caja es segura cuando descartar todas las salidas deja el mismo diagrama que descartar todas las entradas. Un test es seguro solo si es el descarte. El test de fase 0, verde o rojo, no lo es. Una caja tiene fugas cuando en su interior se pierde un hilo cuántico.

### 10/10

Requisitos

- [x] Todo diagrama bien formado tiene un mapa lineal y un número. Dos diagramas son iguales solo si coinciden el mapa y el número.
- [x] Igualar matrices no reescribe. Dos diagramas con el mismo mapa siguen distintos hasta que BL-4 cite una regla.
- [x] Una araña de fase 0 con una entrada y una salida es el hilo. Con dos salidas es la taza. Con dos entradas es la tapa. La taza y la tapa no son el hilo.
- [x] La tapa de dos cúbits, y el test de fase 0, son cajas que solo a veces ocurren. El descarte es el único test que ocurre siempre.
- [x] El test de fase 0 más el test de fase \(\pi\), del mismo color, es el descarte. Olvidar el bit —medir y volver a codificar— borra la fase y tiene fugas.
- [x] El volteo vertical del descarte es el ruido, un estado. Sin el hilo ordinario que avisa el resultado, lo que llega al otro extremo del teléfono es ese ruido.
- [x] La medida no entra en el mapa unitario. El mapa unitario es el tramo anterior a la frontera que guarda el bit.
- [x] Una fase ilegible, un cuarto color, una arista a un nodo ausente o una arista de Hadamard usada como hilo de fusión dejan el diagrama mal formado.

Qué esperar

- [x] \(H\) y el CNOT son seguros: descartar la salida es descartar la entrada.
- [x] Bell y GHZ sin medida: mapa puro, igual al circuito, número a la vista. Con medida: el mapa es el de antes de guardar el bit.
- [x] Descarte de un cúbit de Bell: traza parcial de ese cúbit.
- [x] Tapa de dos cúbits, o test de fase 0: ocurre solo a veces.
- [x] Un diagrama de paleta sin OpenQASM tiene mapa propio y no es un circuito.

Cómo validar

- [x] Esos casos devuelven esa clase.
- [x] La taza desnuda no es segura: su descarte es 2, no 1. La taza con el \(1/2\) sí lo es.
- [x] Dos Bell de la misma matriz y distinta topología no se funden al validar.
- [x] Y sin el factor \(i\) no coincide con su dibujo.

---

## BL-4 — Reglas

`src/lib/zx-core/rewrite.ts`. `apply` cita una regla y devuelve otro diagrama, con su número sin patas. La solidez es que mapa y número coinciden. La completitud que el libro cierra con el corte de patas, el estallido y la última regla vale para fases múltiplo de \(\pi/2\) y para Clifford+\(T\).

No son reglas, y no se implementan: el tirón, la fusión de tazas, el teléfono, el gadget de fase, pivot, complementación local, _full reduce_ y la cirugía de celosía. El tirón y el teléfono salen de las reglas de abajo. El gadget de fase es una araña de BL-0 colgando de un hilo.

### 10/10

Requisitos

- [x] `fuse`. Mismo color y al menos un hilo normal: una araña, patas compartidas fuera, las demás reunidas, fases en \([0, 2\pi)\). La inversa reparte las patas como se quiera y cada pata conserva si entra o sale. Distinto color, sin contacto, o arista de Hadamard: no aplica. Dos puertas del mismo color se fusionan en cuanto un hilo las une, aunque el tiempo las separe.
- [x] `identity`. Fase 0, una entrada y una salida: se quita. Taza y tapa se quedan. Dos Hadamard seguidas son el hilo.
- [x] `color`. Hadamard en todas las patas cambia el color y deja la fase. Empujarla por una pata cambia el color y deja una caja en cada pata por la que no entró.
- [x] `copy`. Una araña de una sola pata la copia una del otro color, y las copias pueden salir en cualquier dirección. El mismo color se fusiona. Un estado que no es araña de una pata no se copia. Ninguna caja copia todos los estados de un cúbit.
- [x] `pi`. Solo la fase \(\pi\) atraviesa el otro color, y niega la fase: \(X(\pi)\,Z(\alpha)=e^{i\alpha}\,Z(-\alpha)\,X(\pi)\) y \(Z(\pi)\,X(\alpha)=e^{i\alpha}\,X(-\alpha)\,Z(\pi)\). El factor es un diagrama sin patas.
- [x] `legs`. Una Z y una X unidas por \(n\) hilos quedan unidas por \(n \bmod 2\). Se cita sola. Con una sola pata no hay par que cortar.
- [x] `square`. Cuatro arañas en ciclo, colores alternados, un hilo entre vecinas, pasan a dos arañas que comparten un hilo. Cada pata exterior vuelve a la araña del color opuesto al de la araña de la que salía. Implica `legs`. `legs` sigue pudiendo citarse sin dibujar el ciclo.
- [x] `last`. \(Z(\alpha)\,X(\beta)\,Z(\gamma)\) pasa a \(X(\alpha')\,Z(\beta')\,X(\gamma')\), y al revés si se empieza por X. Las fases nuevas salen de igualar las matrices, fase global incluida. Si esa fase no es 1, se escribe como número. `legs` y `square` no resuelven esta tripleta.
- [x] El intercambio de dos hilos es la cadena `square`, luego `fuse`, luego `legs`, sobre tres CNOT alternados. No es una regla nueva.
- [x] El teletransporte con una tapa es una caja que solo a veces ocurre. El que ocurre siempre suma los cuatro tests y manda el resultado por un hilo ordinario: si el bit de \(A\) es 1, \(B\) recibe \(X\); si el bit de \(\psi\) es 1, \(B\) recibe \(Z\).
- [x] `apply` no cambia el OpenQASM. `synthesize` escribe compuertas solo con una lista única de BL-0.

Qué esperar

- [x] Dos `rz` unidas por un hilo se fusionan. `S` seguida de `S` queda en \(\pi\). Cuatro `T` quedan en \(\pi\).
- [x] `rz(0)` desaparece. `H` seguida de `H` desaparece. La taza permanece.
- [x] Hadamard en todas las patas de una Z(\(\alpha\)) deja una X(\(\alpha\)).
- [x] \(|1\rangle\) se copia al tocar una araña Z. \(|+\rangle\) no se parte al tocar esa misma araña.
- [x] \(X(\pi)\) a través de \(Z(\pi/2)\) deja fase \(3\pi/2\) y el factor \(e^{i\pi/2}\). Una fase \(\pi/4\) no tiene paso `pi`.
- [x] Dos hilos entre Z y X desaparecen. Tres dejan uno. El ciclo de cuatro queda en dos arañas que comparten un hilo.
- [x] Tres CNOT alternados quedan en los dos hilos cruzados, por la cadena dicha, y la matriz es la de `swap`.
- [x] Una tripleta con una fase \(\pi/4\) cambia solo con `last`.
- [x] Bell sin medida llega a la taza por reglas citadas, con el número que las matrices exijan. La tapa sobre esa taza, el tirón, deja el hilo si el número es el de la taza desnuda, y deja \(\tfrac{1}{2}\) veces el hilo si el número es el del circuito.
- [x] Sustituir la tapa del teletransporte por un descarte deja ruido, no el estado enviado.
- [x] Después de cualquier paso, `validateSync` sigue en verde.

Cómo validar

- [x] Solidez: mapa y número de antes y de después coinciden.
- [x] Clifford: un par con fases múltiplo de \(\pi/2\) y la misma matriz no se alcanza con `fuse`, `identity` y `color`, y sí con `legs` o `square`.
- [x] Clifford+\(T\): un par con una fase múltiplo de \(\pi/4\) que no es múltiplo de \(\pi/2\) no se alcanza sin `last`.
- [x] `fuse` en distinto color, sin contacto y por una arista de Hadamard devuelve error.
- [x] `copy` en el mismo color, y sobre un estado que no es araña de una pata, devuelve error.
- [x] `pi` sin \(e^{i\alpha}\) no iguala las matrices.
- [x] El OpenQASM, después de la cadena, es el de antes. `synthesize` de dos fases fundidas devuelve un solo `rz` con la suma.

---

## BL-3 — La fórmula es el mapa y el número

`src/lib/zx-core/latex.ts`. `explain` escribe el mapa de BL-0 y el número de BL-1. La prosa usa la palabra del libro; el nombre profesional de `lab/book/chapters/07-nombres-profesionales/resumen.md` es la misma igualdad, no otra regla.

### 10/10

Requisitos

- [x] La fórmula de una araña es la de su generador. La de un diagrama es su composición, con el diagrama sin patas escrito como número.
- [x] La taza desnuda se escribe \(|00\rangle+|11\rangle\). El Bell del circuito se escribe \((|00\rangle+|11\rangle)/\sqrt{2}\). Son fórmulas distintas: una descarta a 2 y la otra a 1.
- [x] Elegir un nodo escribe ese generador. Elegir el diagrama entero escribe la composición.
- [x] Con medidas, la fórmula es el mapa anterior al bit guardado.
- [x] Una amplitud es el número de un estado cerrado con un test. La probabilidad es el módulo al cuadrado de esa amplitud. La probabilidad de un estado es lo que queda al descartar su salida; si el estado es seguro, esa probabilidad es 1.
- [x] Los ángulos se escriben en \(\pi\). Un decimal aparece solo en un estado calculado por BL-2.

Qué esperar

- [x] Araña Z de fase \(\alpha\): \(|0\dots 0\rangle\langle 0\dots 0| + e^{i\alpha}|1\dots 1\rangle\langle 1\dots 1|\).
- [x] \(H\) sobre \(|0\rangle\): \((|0\rangle+|1\rangle)/\sqrt{2}\).
- [x] Y muestra el factor \(i\). Después de `pi` con \(\alpha=\pi/2\), la fórmula contiene \(e^{i\pi/2}\) y la fase \(3\pi/2\).
- [x] La araña Z sin patas se escribe como el número 2.

Cómo validar

- [x] La fórmula del circuito y la de sus arañas coinciden en Bell, GHZ, el test de Hadamard y dos `rz` seguidas, número incluido.
- [x] Después de cada regla de BL-4, las dos fórmulas tienen la misma matriz y el mismo número.
- [x] Pedir Bell con medidas devuelve el mapa anterior al bit, no un ket del circuito ya medido.

---

## BL-2 — Ejecutar ese mapa

`run` tiene dos modos, `simulator` y `hardware`. Quien ejecuta no elige statevector, densidad ni MPS. El hardware envía el OpenQASM del circuito. La clave de IBM no entra en el circuito, ni en el export, ni en el JSON.

El simulador calcula el mapa de BL-1. Statevector si el mapa es puro y \(n \le 12\). Si hay medidas, ese vector es el de antes del bit y las cuentas se muestrean con el módulo al cuadrado. Densidad si el mapa es el descarte y \(n \le 8\). Por encima, MPS de un circuito, con `exact: false` y el tope de enlace declarado; si el enlace lo supera, error. Una caja que solo a veces ocurre, y un diagrama mal formado, no corren como si ocurrieran siempre.

### 10/10

Requisitos

- [x] El resultado es el mapa: amplitudes si es puro, traza si hay descarte, cuentas si se guarda el bit. La probabilidad de cada cuenta es el módulo al cuadrado de su amplitud.
- [x] La taza desnuda no se ejecuta como estado seguro. El Bell del circuito sí: descartarlo pesa 1.
- [x] Una tapa de dos cúbits, o un test de fase 0, no produce amplitudes ni cuentas.
- [x] El hardware corre solo un circuito con medidas cuyo diagrama es equivalente al texto enviado. Devuelve cuentas y no devuelve el mapa.
- [x] Una reescritura sin `synthesize` no cambia el texto que el hardware recibe.

Qué esperar

- [x] Bell del circuito: amplitudes de \((|00\rangle+|11\rangle)/\sqrt{2}\). Con medidas: esas amplitudes y cuentas en `00` y `11`.
- [x] Descartar un cúbit de ese Bell: la densidad maximamente mixta del otro.
- [x] Trece cúbits en cadena: MPS con `exact: false`, o error si el tope no alcanza.
- [x] Hardware de Bell con medidas: solo cuentas.

Cómo validar

- [x] El vector de Bell es el estado que BL-3 escribe para el circuito, no el de la taza desnuda.
- [x] Las cuentas salen de ese vector, el de antes de medir, por el módulo al cuadrado.
- [x] Un diagrama con tapa de dos cúbits no devuelve resultado.
- [x] El OpenQASM enviado al hardware es el del circuito anterior a la reescritura.

---

# Interfaz

Lo de abajo se ve en pantalla. No añade mapas, reglas ni números. La lógica ya decidió el contenido. El inspector, el resumen y el lienzo están en `src/App.tsx` y en `src/components/views/Spider3DCanvasView.tsx`. Llaman a `explain`, `denote` y `run`.

### 10/10

Requisitos

- [x] El tiempo del libro va hacia arriba y el de la app de izquierda a derecha. En pantalla se mantiene el de la app. Antes y después los decide la conexión, no el eje.
- [x] Verde y blanco pintan Z. Rojo y gris pintan X. Ámbar pinta Hadamard. El trazo simple es el hilo cuántico y el doble, el ordinario. Ninguno crea un generador.
- [x] El punto que enseña si una caja se dio la vuelta enseña el volteo que BL-0 ya calculó: la fase \(2\pi-\alpha\).
- [x] Arrastrar un nodo cambia coordenadas. No cambia el diagrama que `denote` y `apply` leen.
- [x] Con un nodo elegido, el inspector escribe `explain(grafo, id)`. Sin nodo elegido, el resumen escribe `explain(grafo)`. Grados o \(\pi\) editan la misma fase guardada.
- [x] Junto al diagrama se marca la clase que `denote` ya devolvió: seguro, tal vez, fugas o ruido.
- [x] Hay dos acciones, simulador y hardware, y el lugar donde se pone la clave. Las dos llaman a `run`. Quien ejecuta no elige statevector, densidad ni MPS. La clave no se escribe en el circuito, ni en el OpenQASM, ni en el resultado.
- [x] El city plot dibuja las amplitudes de `run`. El histograma dibuja las cuentas. El hardware solo muestra el histograma.

Qué esperar

- [x] Elegir la caja de Hadamard muestra su generador. El resumen del Bell del circuito muestra \((|00\rangle+|11\rangle)/\sqrt{2}\).
- [x] Simular ese Bell llena el city plot con esas amplitudes. Con medidas, el histograma tiene cuentas en `00` y `11`.
- [ ] La marca del Bell del circuito es seguro. La de la tapa es tal vez. La del descarte de un cúbit de ese Bell es fugas.
- [x] La acción de correr deja de abrir solo la vista de compuertas.

Cómo validar

- [x] Mover un nodo no cambia la fórmula ni la clase.
- [x] El texto del inspector y el del resumen son el `latex` de `explain`.
- [ ] La clave escrita en pantalla no aparece en el OpenQASM exportado ni en el JSON del resultado.
- [ ] Un diagrama con tapa no dibuja amplitudes ni cuentas.

## Panel derecho: el estado al elegir

A la derecha del lienzo, un panel muestra el estado del elemento en el que se hace clic, como el panel de propiedades de Figma. El texto es el que `explain` ya escribe. Sin elección, el panel no inventa un nodo. Con varios, muestra el grupo. Conectar, agregar al circuito y borrar siguen ahí y llaman a lo mismo.

### 10/10

Requisitos

- [x] Elegir un nodo abre su estado en el panel derecho, al lado del lienzo.
- [x] Ese estado es `explain(grafo, id)`, más la fase, el hilo o el símbolo de paleta, la posición y las aristas. Grados o \(\pi\) editan la misma fase guardada.
- [x] Sin nodo elegido, el panel derecho no escribe fórmula. El resumen de abajo sigue escribiendo `explain(grafo)`.
- [x] Con varios nodos, el panel dice cuántos hay y deja mover el grupo y borrar los que se pueden borrar.

Qué esperar

- [x] Clic en la caja de Hadamard muestra su generador en el panel derecho.
- [x] Clic en el lienzo vacío deja el panel sin nodo.
- [x] La fórmula del Bell del circuito, sin nodo elegido, sigue en el resumen.

Cómo validar

- [x] El texto del panel derecho es el `latex` de `explain` del nodo elegido.
- [x] Elegir un nodo no cambia el mapa ni el OpenQASM.

---

## Lienzo: seleccionar vs moverse

El botón izquierdo edita el grafo; el del medio mueve la cámara. Así se puede comparar A/B sin arrastrar nodos por accidente.

### 10/10

Requisitos

- [x] Clic en un nodo lo selecciona; arrastrar un nodo ya seleccionado lo mueve (y el grupo si hay varios).
- [x] Arrastrar en vacío hace caja de selección; Ctrl/Cmd suma a la selección.
- [x] Rueda central sostenida (middle-drag) pannea el espacio; el cursor pasa a manito.
- [x] En 3D, Alt + clic izquierdo orbitan; el izquierdo solo no pannea ni rota.
- [x] Cursores distintos: pointer (hover), crosshair (caja), move (nodos), grab/grabbing (pan).

Qué esperar

- [x] Clic en un nodo no mueve la cámara.
- [x] Middle-drag mueve la vista y deja la selección igual.
- [x] Caja sobre varios nodos permite arrastrar el grupo después.

Cómo validar

- [x] El tour y el README describen clic → seleccionar, left-drag seleccionado → mover, empty left-drag → caja, middle-drag → pan.

---

## Backlog de UI (pendiente)

- [ ] Añadir logo de Qnow.
- [ ] Permitir Ctrl+Z (deshacer) en el canvas.
- [x] Cambiar el cursor a manito al arrastrar para mover el lienzo.
- [x] Solo debería poder moverse con la rueda central o con la manito.
- [ ] Capacidad para desconectar y reconectar cúbits.
- [ ] Limpiar / clearer el botón de elementos.
- [ ] Arreglar la fórmula `(|000\rangle+|111\rangle)/\sqrt{2}`.
- [ ] Consistencia en los botones de riesgo (componente específico).
- [ ] Revisar si Load preset podría borrar cambios previos guardados en Saved: ¿cuándo se hace el saved?
