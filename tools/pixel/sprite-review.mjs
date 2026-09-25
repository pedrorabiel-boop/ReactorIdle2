// Página de revisión: sprite actual vs. propuestas, sobre pasto y sobre panel.
// Uso: node tools/pixel/sprite-review.mjs
import { mkdirSync, writeFileSync } from 'node:fs'
import { ENVIRONMENTS, rowsToSvg, SPRITES, validate } from '../../src/ui/pixel/sprites.ts'
import { CANDIDATES } from './candidates.mjs'

validate()

const env = ENVIRONMENTS.terrestrial
for (const [key, group] of Object.entries(CANDIDATES)) {
  for (const option of group.options) {
    if (option.rows.length !== 16) throw new Error(`${option.id}: ${option.rows.length} filas`)
    option.rows.forEach((row, y) => {
      if (row.length !== 16) throw new Error(`${option.id} fila ${y}: ${row.length} columnas`)
    })
  }
  if (!SPRITES[group.current]) throw new Error(`${key}: falta el sprite actual ${group.current}`)
}

const big = (rows) => rowsToSvg(rows, env, { size: 128 })
const game = (rows) => rowsToSvg(rows, env, { size: 48 })

function card(label, tag, rows, note) {
  return `<article class="card">
    <header><h3>${label}</h3>${tag}</header>
    <div class="views">
      <div class="view grass"><div class="big">${big(rows)}</div><div class="row">${game(rows)}${game(rows)}${game(rows)}</div><small>en el mapa · 48 px</small></div>
      <div class="view panel"><div class="row">${game(rows)}${rowsToSvg(rows, env, { size: 32 })}</div><small>en la bandeja</small></div>
    </div>
    ${note ? `<p>${note}</p>` : ''}
  </article>`
}

const sections = Object.values(CANDIDATES).map((group) => `
  <section>
    <h2>${group.title}</h2>
    <div class="cards">
      ${card('Actual', '<span class="tag now">EN EL JUEGO</span>', SPRITES[group.current], '')}
      ${group.reference ? card(group.reference.name, '<span class="tag now">RONDA ANTERIOR</span>', group.reference.rows, group.reference.note ?? '') : ''}
      ${group.options.map((option, i) => card(option.name, `<span class="tag">PROPUESTA ${'AB'[i]}</span>`, option.rows, option.note)).join('')}
    </div>
  </section>`).join('')

const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Revisión de sprites</title>
<link href="https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  :root { --ink:#12121f; --panel:#1c1f2e; --panel-2:#262a3d; --edge:#3b4058; --text:#f4f4f8; --muted:#9aa0b5; --gold:#ffd53d; --cyan:#5ff3e6; --grass:#5fc531; }
  * { box-sizing: border-box; }
  body { margin:0; padding:20px; background:var(--ink); color:var(--text); font-family:'Pixelify Sans',system-ui,sans-serif; }
  h1 { font-size:22px; margin:0 0 4px; }
  .lede { color:var(--muted); font-size:14px; margin:0 0 22px; }
  section { margin-bottom:26px; }
  h2 { font-size:17px; color:var(--gold); margin:0 0 10px; padding-bottom:6px; border-bottom:2px solid var(--edge); }
  .cards { display:grid; grid-template-columns:repeat(auto-fit,minmax(230px,1fr)); gap:12px; }
  .card { background:var(--panel); border:3px solid var(--edge); border-radius:6px; padding:10px; box-shadow:inset -3px -3px 0 rgba(0,0,0,.35), inset 3px 3px 0 rgba(255,255,255,.06); }
  .card header { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:8px; }
  h3 { font-size:14px; margin:0; }
  .tag { font-size:10px; letter-spacing:.06em; color:var(--cyan); border:2px solid var(--edge); border-radius:4px; padding:2px 5px; white-space:nowrap; }
  .tag.now { color:var(--muted); }
  .views { display:grid; gap:8px; }
  .view { padding:8px; border:2px solid rgba(0,0,0,.4); border-radius:4px; display:grid; justify-items:center; gap:6px; }
  .view.grass { background:var(--grass); }
  .view.panel { background:var(--panel-2); }
  .row { display:flex; align-items:flex-end; gap:4px; }
  .view small { font-size:10px; color:rgba(0,0,0,.55); }
  .view.panel small { color:var(--muted); }
  svg { display:block; image-rendering:pixelated; }
  .card p { margin:8px 0 0; font-size:12px; line-height:1.4; color:var(--muted); }
</style>
</head>
<body>
  <h1>Revisión de sprites</h1>
  <p class="lede">Cada propuesta se muestra a 128 px, al tamaño real del mapa (48 px, repetida para ver cómo se agrupa) y al tamaño de la bandeja.</p>
  ${sections}
</body>
</html>
`

mkdirSync('docs/mockup', { recursive: true })
writeFileSync('docs/mockup/sprite-review.html', html)
console.log(`docs/mockup/sprite-review.html · ${(html.length / 1024).toFixed(0)} KB`)
