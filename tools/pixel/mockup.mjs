// Genera docs/mockup/index.html: propuesta visual pixel art del frontend.
// Uso: node tools/pixel/mockup.mjs
import { mkdirSync, writeFileSync } from 'node:fs'
import { COMPONENT_SPRITES, ENVIRONMENTS, envCssVars, PROPOSED_SPRITES, rowsToSvg, terrainRows, toSvg, validate } from '../../src/ui/pixel/sprites.ts'

validate()

const TILE = 48 // 16 px lógicos × 3
const MAP_COLS = 14
const MAP_ROWS = 16
const GRID = { x: 3, y: 3, cols: 8, rows: 10 } // igual que el motor: 8×10

const NAMES = {
  wind: 'Eólica', solar: 'Solar', battery: 'Batería', controller: 'Control',
  core: 'Núcleo', thorium: 'Torio', fusion: 'Fusión', generator: 'Turbina', generator2: 'Turbina II',
  cooler: 'Enfriador', exchanger: 'Interc.', pipe: 'Tubería', accumulator: 'Depósito',
  sales: 'Ventas', sales2: 'Ventas II', research: 'I+D', research2: 'I+D II', insulator: 'Aislante',
}
const COSTS = { wind: 50, solar: 110, battery: 350, controller: 800, core: 180, thorium: 900, fusion: 4500, generator: 160, generator2: 1600, cooler: 90, exchanger: 60, pipe: 25, accumulator: 140, sales: 150, sales2: 1500, research: 200, research2: 2000, insulator: 40 }
const LOCKED = new Set(['fusion', 'controller'])

// Layout de ejemplo de la grilla 8×10 (w eólica, s solar, b batería, x control,
// c núcleo, t torio, f fusión, g turbina, k enfriador, e interc., p tubería, a depósito)
const LAYOUT = [
  'w s . . s w . .',
  's . c g k . s .',
  '. b . e p . . w',
  'w . . . a . . .',
  '. s . t g k b .',
  '. . . . . . . .',
  'x . . f p g . s',
  '. . k . e . . .',
  'w s . . . . w .',
  '. . . . . . . .',
].map((row) => row.split(' '))
const KEY = { w: 'wind', s: 'solar', b: 'battery', x: 'controller', c: 'core', t: 'thorium', f: 'fusion', g: 'generator', k: 'cooler', e: 'exchanger', p: 'pipe', a: 'accumulator' }

// ─── Isla ───
const inGrid = (x, y) => x >= GRID.x && x < GRID.x + GRID.cols && y >= GRID.y && y < GRID.y + GRID.rows
// Anillo de tierra alrededor de la grilla con "mordidas" para que no sea un rectángulo.
const bites = new Set(['2,2', '11,2', '2,13', '11,13', '11,7', '2,9'])
const islets = [[0, 14], [1, 14], [1, 15], [12, 0], [13, 0], [13, 1], [0, 5], [12, 15], [13, 15]]
function isLand(x, y) {
  if (inGrid(x, y)) return true
  const ring = x >= GRID.x - 1 && x <= GRID.x + GRID.cols && y >= GRID.y - 1 && y <= GRID.y + GRID.rows
  if (ring && !bites.has(`${x},${y}`)) return true
  return islets.some(([ix, iy]) => ix === x && iy === y)
}
// Decoraciones deterministas en tierra fuera de la grilla
function decorationAt(x, y) {
  if (!isLand(x, y) || inGrid(x, y)) return null
  const h = (x * 73856093) ^ (y * 19349663)
  const v = Math.abs(h) % 7
  if (v <= 2) return 'DECOR'
  if (v === 3) return 'rock'
  return null
}

const svg = (name, size, cls = '') => toSvg(name, undefined, { size, cssVars: true, className: cls })
const terrainAt = (x, y) => isLand(x, y) ? 'land' : 'water'
const terrainSvg = (x, y) => {
  const n = { n: terrainAt(x, y - 1), e: terrainAt(x + 1, y), s: terrainAt(x, y + 1), w: terrainAt(x - 1, y), ne: terrainAt(x + 1, y - 1), nw: terrainAt(x - 1, y - 1), se: terrainAt(x + 1, y + 1), sw: terrainAt(x - 1, y + 1) }
  return rowsToSvg(terrainRows(terrainAt(x, y), n), undefined, { size: TILE, cssVars: true, className: 'terrain' })
}

// ─── Mundo ───
let world = ''
for (let y = 0; y < MAP_ROWS; y++) {
  for (let x = 0; x < MAP_COLS; x++) {
    const kind = terrainAt(x, y)
    const grid = inGrid(x, y)
    const layers = [terrainSvg(x, y)]
    const decor = decorationAt(x, y)
    if (decor === 'DECOR') layers.push(`<span class="decor">${svg('tree', TILE, 'd-terrestrial')}${svg('mushroom', TILE, 'd-alien')}${svg('pylon', TILE, 'd-futuristic')}</span>`)
    else if (decor) layers.push(svg(decor, TILE))
    let extra = ''
    if (grid) {
      const gx = x - GRID.x, gy = y - GRID.y
      const piece = KEY[LAYOUT[gy][gx]]
      if (piece) {
        const thermal = ['core', 'thorium', 'fusion', 'generator', 'cooler', 'exchanger', 'pipe', 'accumulator'].includes(piece)
        const heat = { core: 3, thorium: 2, fusion: 4, generator: 1, cooler: 1, exchanger: 2, pipe: 1, accumulator: 2 }[piece] ?? 0
        layers.push(`<span class="piece ${piece}">${svg(piece, TILE)}</span>`)
        if (thermal) layers.push(`<span class="heat h${heat}"><i></i><i></i><i></i><i></i><i></i></span>`)
        if (piece === 'wind' && gx === 0 && gy === 0) extra = '<span class="pop">+2⚡</span>'
        if (piece === 'core' && gy === 1) extra = '<span class="pop pop-coin">+₡12</span>'
      }
      if (gx === 5 && gy === 5) layers.push(`<span class="ghost">${svg('wind', TILE)}</span>`)
    }
    world += `<div class="tile ${kind}${grid ? ' grid' : ''}" style="left:${x * TILE}px;top:${y * TILE}px">${layers.join('')}${extra}</div>`
  }
}

// ─── Bandeja de construcción ───
const cards = [...COMPONENT_SPRITES, ...PROPOSED_SPRITES].map((name, index) => {
  const proposed = PROPOSED_SPRITES.includes(name)
  const locked = LOCKED.has(name)
  return `<button class="card${index === 0 ? ' selected' : ''}${locked ? ' locked' : ''}${proposed ? ' proposed' : ''}" ${locked ? 'disabled' : ''}>
    ${svg(name, 32)}
    <span class="card-name">${NAMES[name]}</span>
    <span class="card-cost">${locked ? '🔒 50k MW' : `<i class="coin"></i>${COSTS[name]}`}</span>
    ${proposed ? '<span class="tag">NUEVO</span>' : ''}
  </button>`
}).join('')

// ─── Minimapa ───
let mini = ''
for (let y = 0; y < MAP_ROWS; y++) for (let x = 0; x < MAP_COLS; x++) {
  const c = isLand(x, y) ? 'var(--px-1)' : 'transparent'
  if (c !== 'transparent') mini += `<i style="left:${x * 4}px;top:${y * 4}px;background:${c}"></i>`
}

const envVars = Object.entries(ENVIRONMENTS).map(([key, env]) => `body[data-env="${key}"]{${envCssVars(env)};--glow:${env.glow}}`).join('\n')
const envButtons = Object.entries(ENVIRONMENTS).map(([key, env], i) => `<button data-set-env="${key}" class="${i === 0 ? 'on' : ''}">${env.name}</button>`).join('')

const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">
<title>Nucleus · Mockup pixel</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Pixelify+Sans:wght@400;600;700&display=swap" rel="stylesheet">
<style>
${envVars}
:root { --ink: #12121f; --panel: #1c1f2e; --panel-2: #262a3d; --edge: #3b4058; --text: #f4f4f8; --muted: #9aa0b5; --gold: #ffd53d; --green: #7dff6a; --cyan: #5ff3e6; --red: #ff5d5d; --tile: ${TILE}px; }
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; overflow: hidden; background: var(--px-4); }
body { font-family: 'Pixelify Sans', system-ui, sans-serif; color: var(--text); -webkit-font-smoothing: none; }
.num { font-family: 'Press Start 2P', monospace; }
svg { display: block; image-rendering: pixelated; }

/* ─── Mapa (fondo, scroll XY) ─── */
.viewport { position: fixed; inset: 0; overflow: auto; overscroll-behavior: contain; scrollbar-width: none; }
.viewport::-webkit-scrollbar { display: none; }
.world { position: relative; width: ${MAP_COLS * TILE}px; height: ${MAP_ROWS * TILE}px; margin: 96px 24px 260px; background: var(--px-4); }
.tile { position: absolute; width: var(--tile); height: var(--tile); }
.tile > * { position: absolute; inset: 0; }
.decor svg { display: none; }
body[data-env="terrestrial"] .d-terrestrial, body[data-env="alien"] .d-alien, body[data-env="futuristic"] .d-futuristic { display: block; }
.piece { filter: drop-shadow(0 2px 0 rgba(0,0,0,.35)); }
.piece.core, .piece.thorium, .piece.fusion { animation: reactor 1.6s ease-in-out infinite; }
.piece.wind { animation: bob 2.4s ease-in-out infinite; }
@keyframes reactor { 50% { filter: drop-shadow(0 2px 0 rgba(0,0,0,.35)) drop-shadow(0 0 6px var(--px-O)); } }
@keyframes bob { 50% { transform: translateY(-1px); } }
.heat { position: absolute; left: 6px; right: 6px; bottom: 3px; top: auto; height: 4px; display: flex; gap: 1px; }
.heat i { flex: 1; background: rgba(0,0,0,.35); border: 1px solid rgba(0,0,0,.5); }
.heat.h1 i:nth-child(-n+1), .heat.h2 i:nth-child(-n+2), .heat.h3 i:nth-child(-n+3), .heat.h4 i:nth-child(-n+4) { background: var(--green); }
.heat.h3 i:nth-child(3), .heat.h4 i:nth-child(3) { background: var(--gold); }
.heat.h4 i:nth-child(4) { background: var(--red); }
.ghost { opacity: .5; animation: blink 1s steps(2) infinite; }
.ghost::after { content: ''; position: absolute; inset: 0; border: 2px dashed #fff; }
@keyframes blink { 50% { opacity: .25; } }
.pop { position: absolute; left: 0; right: 0; top: -6px; text-align: center; font: 10px 'Press Start 2P', monospace; color: var(--green); text-shadow: 2px 2px 0 var(--ink); animation: pop 1.8s ease-out infinite; pointer-events: none; }
.pop-coin { color: var(--gold); animation-delay: .9s; }
@keyframes pop { 0% { transform: translateY(0); opacity: 0; } 15% { opacity: 1; } 100% { transform: translateY(-28px); opacity: 0; } }

/* ─── Marco pixel reutilizable ─── */
.frame { background: var(--panel); border: 3px solid var(--edge); box-shadow: inset -3px -3px 0 rgba(0,0,0,.35), inset 3px 3px 0 rgba(255,255,255,.06), 0 4px 0 rgba(0,0,0,.4); border-radius: 6px; }

/* ─── HUD superior ─── */
.hud { position: fixed; top: 0; left: 0; right: 0; z-index: 10; display: flex; gap: 6px; padding: calc(10px + env(safe-area-inset-top)) 10px 10px; background: linear-gradient(rgba(0,0,0,.55), transparent); pointer-events: none; }
.hud > * { pointer-events: auto; }
.res { flex: 1; min-width: 0; display: grid; grid-template-columns: 18px 1fr; column-gap: 5px; align-items: center; padding: 6px 6px; }
.res .ico { font-size: 14px; line-height: 1; text-align: center; }
.res .val { font: 10px 'Press Start 2P', monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.res .rate { grid-column: 2; font: 8px 'Press Start 2P', monospace; color: var(--green); margin-top: 4px; }
.icon-btn { width: 44px; height: 44px; flex: 0 0 auto; display: grid; place-items: center; font-size: 20px; color: var(--text); cursor: pointer; padding: 0; }
.icon-btn:active, .card:active { transform: translateY(2px); box-shadow: inset -3px -3px 0 rgba(0,0,0,.35), inset 3px 3px 0 rgba(255,255,255,.06); }

/* ─── Minimapa + selector de ambiente ─── */
.minimap { position: fixed; z-index: 10; right: 10px; top: calc(74px + env(safe-area-inset-top)); width: ${MAP_COLS * 4 + 12}px; height: ${MAP_ROWS * 4 + 12}px; padding: 3px; }
.minimap i { position: absolute; width: 4px; height: 4px; margin: 3px; }
.minimap b { position: absolute; left: 3px; top: 3px; width: 32px; height: 60px; border: 1px solid #fff; opacity: .8; }
.envbar { position: fixed; z-index: 10; left: 10px; top: calc(74px + env(safe-area-inset-top)); display: flex; gap: 4px; padding: 4px; }
.envbar button { font: 600 10px 'Pixelify Sans', sans-serif; padding: 5px 7px; border: 2px solid transparent; background: transparent; color: var(--muted); cursor: pointer; }
.envbar button.on { color: var(--gold); border-color: var(--edge); background: var(--panel-2); }
.envbar small { position: absolute; left: 0; top: 100%; margin-top: 4px; font-size: 9px; color: #fff; text-shadow: 1px 1px 0 var(--ink), -1px -1px 0 var(--ink); white-space: nowrap; }

/* ─── Dock inferior ─── */
.dock { position: fixed; z-index: 10; left: 0; right: 0; bottom: 0; padding: 0 0 calc(8px + env(safe-area-inset-bottom)); background: linear-gradient(transparent, rgba(0,0,0,.6) 30%); }
.tray { margin: 0 8px 6px; padding: 6px 8px 7px; }
.tray-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 5px; }
.tray-head strong { font: 600 13px 'Pixelify Sans', sans-serif; color: var(--gold); letter-spacing: .04em; }
.tray-head span { font: 10px 'Pixelify Sans', sans-serif; color: var(--muted); }
.cards { display: grid; grid-auto-flow: column; grid-template-rows: 1fr 1fr; grid-auto-columns: 64px; gap: 5px; overflow-x: auto; scrollbar-width: none; scroll-snap-type: x proximity; padding-bottom: 2px; }
.cards::-webkit-scrollbar { display: none; }
.card { position: relative; display: grid; justify-items: center; gap: 2px; padding: 5px 2px 4px; scroll-snap-align: start; cursor: pointer; color: var(--text); background: var(--panel-2); }
.card.selected { border-color: var(--gold); background: #33351f; box-shadow: inset -3px -3px 0 rgba(0,0,0,.35), inset 3px 3px 0 rgba(255,255,255,.06), 0 0 0 2px var(--ink), 0 0 10px var(--gold); }
.card.locked { opacity: .45; filter: grayscale(.8); cursor: not-allowed; }
.card-name { font: 600 10px 'Pixelify Sans', sans-serif; white-space: nowrap; }
.card-cost { display: flex; align-items: center; gap: 3px; font: 8px 'Press Start 2P', monospace; color: var(--gold); }
.coin { width: 8px; height: 8px; background: var(--gold); border: 1px solid #a37c00; border-radius: 50%; }
.tag { position: absolute; top: -4px; right: -4px; font: 7px 'Press Start 2P', monospace; padding: 2px 3px; background: var(--cyan); color: var(--ink); }
.tabs { display: flex; gap: 6px; margin: 0 8px; }
.tab { flex: 1; display: grid; justify-items: center; gap: 3px; padding: 6px 2px; font: 600 10px 'Pixelify Sans', sans-serif; color: var(--muted); cursor: pointer; }
.tab em { font-style: normal; font-size: 16px; line-height: 1; }
.tab.on { color: var(--gold); background: var(--panel-2); }
.tab .badge { position: absolute; top: -6px; right: -4px; min-width: 16px; height: 16px; display: grid; place-items: center; font: 8px 'Press Start 2P', monospace; color: var(--ink); background: var(--red); border: 2px solid var(--ink); border-radius: 50%; }
.tab { position: relative; }
</style>
</head>
<body data-env="terrestrial">

<div class="viewport"><div class="world">${world}</div></div>

<header class="hud">
  <div class="res frame"><span class="ico">⚡</span><span class="val">1.286</span><span class="rate">+42/min</span></div>
  <div class="res frame"><span class="ico">🪙</span><span class="val">1.520</span><span class="rate">+120/min</span></div>
  <div class="res frame"><span class="ico">🧪</span><span class="val">35</span><span class="rate">+3/min</span></div>
  <button class="icon-btn frame" aria-label="Ajustes">⚙</button>
</header>

<div class="envbar frame">${envButtons}<small>Solo mockup: en el juego lo fija el sector / nivel</small></div>
<div class="minimap frame">${mini}<b></b></div>

<footer class="dock">
  <section class="tray frame">
    <div class="tray-head"><strong>CONSTRUIR</strong><span>Toca una casilla · arrastra para trazar</span></div>
    <div class="cards">${cards}</div>
  </section>
  <nav class="tabs">
    <button class="tab frame on"><em>🔨</em>Construir</button>
    <button class="tab frame"><em>🔍</em>Inspector</button>
    <button class="tab frame"><em>🧪</em>Lab<span class="badge">2</span></button>
    <button class="tab frame"><em>📜</em>Contratos<span class="badge">!</span></button>
    <button class="tab frame"><em>☰</em>Menú</button>
  </nav>
</footer>

<script>
document.querySelectorAll('[data-set-env]').forEach((button) => button.addEventListener('click', () => {
  document.body.dataset.env = button.dataset.setEnv
  document.querySelectorAll('[data-set-env]').forEach((b) => b.classList.toggle('on', b === button))
}))
document.querySelectorAll('.card:not(.locked)').forEach((card) => card.addEventListener('click', () => {
  document.querySelectorAll('.card').forEach((c) => c.classList.toggle('selected', c === card))
}))
// Centrar el mapa en la grilla al abrir
const vp = document.querySelector('.viewport')
vp.scrollLeft = ${GRID.x * TILE + 24 + (GRID.cols * TILE) / 2} - window.innerWidth / 2
vp.scrollTop = ${GRID.y * TILE + 96 + (GRID.rows * TILE) / 2} - window.innerHeight / 2 + 60
const cursor = document.querySelector('.minimap b')
const syncMini = () => { cursor.style.left = 3 + (vp.scrollLeft - 24) / ${TILE} * 4 + 'px'; cursor.style.top = 3 + (vp.scrollTop - 96) / ${TILE} * 4 + 'px'; cursor.style.width = window.innerWidth / ${TILE} * 4 + 'px'; cursor.style.height = (window.innerHeight - 260) / ${TILE} * 4 + 'px' }
vp.addEventListener('scroll', syncMini); syncMini()
</script>
</body>
</html>
`

mkdirSync('docs/mockup', { recursive: true })
writeFileSync('docs/mockup/index.html', html)
console.log(`docs/mockup/index.html · ${(html.length / 1024).toFixed(0)} KB`)
