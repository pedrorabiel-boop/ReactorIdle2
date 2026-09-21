# Nucleus · Idle Lab

Prototipo mobile-first de un juego idle energético. Comienza con renovables sencillas y evoluciona hacia plantas térmicas donde deberás transportar calor sin provocar una explosión.

## Probar localmente

Requiere Node.js 22 o una versión compatible.

```bash
npm install
npm run dev
```

Abre la dirección indicada por Vite. La partida se guarda automáticamente en el navegador.

## Economía v2

La energía ya no se convierte inmediatamente en dinero: entra al almacenamiento global, el jugador puede vender todo el banco manualmente y las oficinas de ventas retiran energía automáticamente a una velocidad limitada. Sin oficina no existe venta automática. Las instalaciones de I+D generan RP pasivamente y el árbol tecnológico usa exclusivamente esos puntos. Eólica, solar y reactores tienen una vida útil corta: al caducar se reconstruyen por su costo completo. Su ciclo inicial produce entre 200 % y 150 % de ese costo, con margen decreciente en tecnologías posteriores. El Laboratorio permite investigar `Auto rebuild` por separado para cada tipo.

Los niveles se compran con créditos por tipo de edificio y benefician a todas sus unidades. `npm run balance` ejecuta la estrategia determinista de referencia y muestra los tiempos hasta cada hito tecnológico y territorial.

## Interfaz pixel art

La planta es una isla pixel art que ocupa toda la pantalla y se desplaza en horizontal y vertical. Sobre ella flotan el HUD superior (créditos, energía y ciencia con su tasa por minuto, control de velocidad y calor en red cuando hay térmica) y la barra de pestañas inferior:

- **Construir** abre la bandeja de piezas ya desbloqueadas. Con una pieza seleccionada aparece la grilla construible: toca una casilla para colocar o arrastra para trazar varias. Desde la misma bandeja se activa **Demoler** y se puede **Deshacer** hasta 20 acciones.
- Tocar cualquier edificio abre su inspector directamente para consultar calor, autonomía y averías, apagar, renovar, reparar o demoler.
- **Mejoras** permite subir globalmente producción, capacidad térmica y autonomía de cada tipo; nunca se mejora una unidad aislada.
- Las piezas caducadas quedan transparentes y conservan su casilla: se reconstruyen desde el inspector o colocando nuevamente el mismo tipo. Para usar la casilla con otro edificio primero hay que demolerla. Los productores con vida útil no tienen reembolso; las demás piezas recuperan el 85 %.
- **Lab** contiene el árbol tecnológico; **Contratos** los bonos opcionales y el protocolo de arranque; **Menú** los sectores, la telemetría y el guardado.

Los sprites (16×16) viven en `src/ui/pixel/sprites.ts` como mapas ASCII; el terreno usa autotiling para dibujar costas onduladas y playas alrededor de la tierra. Las paletas alienígena y futurista se conservan para una futura versión del prestigio. `npm run mockup` regenera `docs/mockup/index.html`.

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

La interfaz se verificó a 375 y 390 px de ancho; en pantallas anchas el mapa sigue siendo el fondo y los paneles se centran. Las fuentes pixel se sirven desde `public/fonts` y quedan en la caché del service worker para el uso offline.

El guardado recupera de forma segura datos inválidos y conserva una copia local antes de reiniciar. La PWA incluye iconos PNG de 192 y 512 px; su instalación, activación y recarga totalmente offline se verificaron en un navegador Chromium sobre el build de producción.
