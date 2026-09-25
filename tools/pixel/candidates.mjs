// Banco de propuestas de sprites en revisión (vacío = nada pendiente).
//
// Flujo: agrega aquí una entrada por sprite a revisar, ejecuta
// `node tools/pixel/sprite-review.mjs` y abre docs/mockup/sprite-review.html
// para comparar la versión actual contra las propuestas sobre pasto y sobre
// panel. Cuando una se aprueba, cópiala a src/ui/pixel/sprites.ts con su
// nombre definitivo y bórrala de aquí.
//
// Formato:
//   <nombreSprite>: {
//     title: 'Nombre visible',
//     current: '<nombre del sprite en sprites.ts>',
//     reference: { name: 'Ronda 1', note: '…', rows: [...] },   // opcional
//     options: [{ id: 'xxx-a', name: '…', note: '…', rows: [16 filas de 16] }],
//   }
//
// Aprobados: generator y generator2 «Ventilador industrial» (2026-09-24),
// sales2 «Vidrios dorados», research2 «Matraz cónico».

export const CANDIDATES = {}
