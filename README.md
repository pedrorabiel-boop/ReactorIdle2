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

La energía ya no se convierte inmediatamente en dinero: las oficinas venden primero hasta la potencia comercial del mapa y solo el excedente entra a su banco local. El jugador también puede vender todo ese banco manualmente. Producción, oficinas, baterías, controladores y mejoras son independientes en cada isla. Sin oficina no existe venta automática. Las instalaciones de I+D generan RP pasivamente y el árbol tecnológico usa exclusivamente esos puntos. Eólica, solar y reactores tienen una vida útil corta: al caducar se reconstruyen por su costo completo. Su ciclo inicial produce entre 200 % y 150 % de ese costo, con margen decreciente en tecnologías posteriores. El Laboratorio permite investigar `Auto rebuild` por separado para cada tipo.

Los diez niveles se compran con créditos por tipo de edificio, parten entre 22,5 y 30 veces el costo de una copia y benefician a todas sus unidades dentro del mapa activo. Cada tier productor nuevo entrega 13,43 veces la potencia del anterior maximizado y cuesta aproximadamente 1–3 minutos de producción de una planta anterior completa. `npm run balance` valida estas proporciones, el retorno de vida útil y las barreras de investigación.

## Interfaz pixel art

La planta es una isla pixel art que ocupa toda la pantalla, se desplaza en horizontal y vertical y permite zoom de 60 % a 160 %. La costa inicial tiene 36 celdas en una silueta irregular. Sobre ella flotan el HUD superior (créditos, banco local, ciencia y calor cuando hay térmica) y la barra de pestañas inferior:

- **Construir** abre la bandeja de piezas ya desbloqueadas. Al elegir una pieza, la interfaz se despeja y queda solo **Terminar**: toca una casilla o arrastra para construir y reconstruir varias torres caducadas. Desde la bandeja también se activa **Demoler** y se puede **Deshacer** hasta 20 acciones.
- Tocar cualquier edificio abre su inspector directamente para consultar calor, autonomía y averías, apagar, renovar, reparar o demoler.
- **Mejoras** permite subir por mapa la producción, capacidad térmica y autonomía de cada tipo; nunca se mejora una unidad aislada.
- Las piezas caducadas quedan transparentes y conservan su casilla: se reconstruyen desde el inspector o colocando nuevamente el mismo tipo. Para usar la casilla con otro edificio primero hay que demolerla. Los productores con vida útil no tienen reembolso; las demás piezas recuperan el 85 %.
- **Lab** contiene el árbol tecnológico; **Contratos** los bonos opcionales y el protocolo de arranque; el **Menú** superior derecho contiene pausa, velocidad, sectores, telemetría y guardado.

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

La interfaz se verificó a 375, 390 y 768 px de ancho; en pantallas anchas el mapa sigue siendo el fondo y los paneles se centran. Las fuentes pixel se sirven desde `public/fonts` y quedan en la caché del service worker para el uso offline.

El guardado recupera de forma segura datos inválidos y conserva una copia local antes de reiniciar. La PWA incluye iconos PNG de 192 y 512 px; su instalación, activación y recarga totalmente offline se verificaron en un navegador Chromium sobre el build de producción.
