# Nucleus · Idle Lab

Prototipo mobile-first de un juego idle energético. Comienza con renovables sencillas y evoluciona hacia plantas térmicas donde deberás transportar calor sin provocar una explosión.

## Probar localmente

Requiere Node.js 22 o una versión compatible.

```bash
npm install
npm run dev
```

Abre la dirección indicada por Vite. La partida se guarda automáticamente en el navegador.

## Mecánica inicial

- **Turbina eólica:** produce 2 MW directamente y está disponible desde el inicio.
- **Panel solar:** produce 4 MW sin calor y se desbloquea al alcanzar 100 MW totales.
- **Núcleo:** introduce la red térmica al alcanzar 750 MW y produce 12 unidades de calor por ciclo.
- **Reactor de torio:** produce 28 unidades y se desbloquea al alcanzar 5.000 MW totales.
- **Reactor de fusión:** produce 72 unidades y se desbloquea al alcanzar 50.000 MW totales.
- **Intercambiador:** extrae y transporta hasta 10 unidades de calor.
- **Tubería térmica:** extiende la red y transporta calor a bajo coste.
- **Acumulador térmico:** almacena hasta 900 unidades y estabiliza la red.
- **Turbina:** convierte hasta 8 unidades de calor en energía.
- **Enfriador:** disipa hasta 12 unidades de calor.
- Una pieza que supera su capacidad térmica explota y desaparece.

El calor solo se mueve entre piezas vecinas en horizontal o vertical. Cuando una pieza transporta o consume calor, la grilla muestra su flujo del último ciclo y una animación de actividad.

Los reactores consumen una carga con duración limitada. La recarga automática viene activada para mantener el progreso idle y paga una carga completa cuando se agota; desde el inspector puede desactivarse o hacerse una recarga manual proporcional al combustible faltante.

Cada componente se desgasta lentamente mientras está activo. El estado es siempre visible: solo por debajo del 50 % empieza una reducción gradual y predecible del rendimiento, nunca una avería aleatoria. El mantenimiento puede pagarse de forma manual y proporcional, o automatizarse para ejecutarse al 25 % si hay créditos disponibles.

Las turbinas también producen ciencia a razón de 0,05 RP por MW. El laboratorio permite invertirla en:

- Contención reforzada para aumentar la capacidad de todos los reactores.
- Aleaciones conductoras para acelerar los intercambiadores.
- Álabes de precisión para convertir más calor en energía.
- Circuitos criogénicos para mejorar la refrigeración.
- Contratos energéticos para aumentar un 20 % por nivel el valor de cada MW.
- Combustible enriquecido para aumentar un 25 % por nivel la duración de cada carga.

Los contratos ofrecen objetivos voluntarios y persistentes de generación renovable, general o térmica. No caducan ni aplican penalizaciones: al completarlos puedes reclamar créditos y ciencia, y el siguiente encargo escala de forma gradual.

Al alcanzar 1.500 MW se desbloquean baterías: almacenan una parte real de la producción renovable, descontándola de la energía vendida, y la entregan cuando las renovables se detienen. Desde 7.500 MW, el controlador de red automatiza una reserva de 10 MW: guarda excedentes y cubre déficits con las baterías. El laboratorio permite mejorar generación renovable, almacenamiento y mantenimiento preventivo.

A los 25.000 MW se abre un segundo sector con grilla independiente. La costa acelera las baterías un 20 % y el desierto aumenta la producción solar un 25 %. Desde 100.000 MW puede reinvertirse voluntariamente la planta: reinicia la progresión y concede un 10 % permanente adicional a la generación renovable y al valor de la energía por nivel.

Las partidas creadas con prototipos anteriores se migran automáticamente. Las del prototipo 01 también reciben la ciencia correspondiente a la energía que ya habían generado.

El tutorial comienza construyendo eólica y solar. Una vez alcanzados 750 MW se desbloquea el primer núcleo; para crear un circuito térmico estable, colócalo junto a una turbina y un enfriador.

## Controles táctiles

1. Selecciona una pieza en la barra inferior.
2. Toca una casilla o arrastra el dedo por varias casillas para construir un trazado completo.
3. Usa **Deshacer** para revertir hasta 20 acciones de planta; un trazado entero cuenta como una sola acción y no revierte la producción idle.
4. Usa **Inspeccionar** para ver la producción directa o la temperatura.
5. Desde el inspector puedes activar o desactivar una pieza sin demolerla.
6. Usa **Demoler** y toca una pieza para recuperar la mitad de su coste.

La velocidad puede cambiarse entre 1×, 2× y 4×. Desde el menú superior se puede exportar o importar una partida.

## Verificación

```bash
npm test
npm run build
```

## Publicar en GitHub Pages

El workflow `.github/workflows/deploy-pages.yml` ejecuta las pruebas, compila y publica el sitio al enviar cambios a `main`.

1. Crea un repositorio de GitHub y sube este proyecto a la rama `main`.
2. En **Settings → Pages**, elige **GitHub Actions** como fuente.
3. Ejecuta el workflow o realiza otro push a `main`.

La aplicación es una PWA: una vez publicada se puede agregar a la pantalla de inicio desde Safari o Chrome y continuar jugando offline después de la primera carga.

La interfaz se verificó en 320, 390 y 768 px. En teléfonos, la grilla y la paleta se desplazan horizontalmente para conservar objetivos táctiles amplios; el tutorial puede plegarse y sus barras de progreso exponen valores accesibles a lectores de pantalla.

El guardado recupera de forma segura datos inválidos y conserva una copia local antes de reiniciar. La PWA incluye iconos PNG de 192 y 512 px; su instalación, activación y recarga totalmente offline se verificaron en un navegador Chromium sobre el build de producción.
