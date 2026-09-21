// Fuente de verdad de los sprites pixel art del juego.
// Cada sprite es una grilla ASCII de 16x16; cada carácter es un color de PALETTE.
// `.` es transparente. Los sprites se exportan como SVG con bordes nítidos.

export type PaletteKey = keyof typeof PALETTE
export type EnvironmentKey = 'terrestrial' | 'alien' | 'futuristic'
export type TerrainKind = 'water' | 'land'
export type Neighbors = Partial<Record<'n' | 'e' | 's' | 'w' | 'ne' | 'nw' | 'se' | 'sw', TerrainKind>>
export interface Environment {
  name: string
  terrain: Record<string, string>
  recolor: Record<string, string>
  decoration: string
  glow: string
}

export const PALETTE = {
  K: '#1b1b2f', // outline
  W: '#f6f6fa', // white
  L: '#c8cdd6', // light grey
  G: '#8b93a0', // grey
  D: '#4b515d', // dark grey
  B: '#2f6fe0', // blue
  b: '#7fc6ff', // light blue
  O: '#ff8a1f', // orange
  Y: '#ffd53d', // yellow
  R: '#e2382f', // red
  r: '#ff8f85', // light red
  E: '#4fb52c', // green
  e: '#8de55f', // light green
  g: '#2c7a26', // dark green
  P: '#a545ff', // purple
  p: '#d69bff', // light purple
  C: '#5ff3e6', // cyan
  T: '#8a5a2b', // brown
  t: '#c98d52', // light brown
  // Terreno (se remapea por ambiente)
  1: '#5fc531', // land
  2: '#79d94a', // land speckle
  3: '#efe1a0', // shore
  4: '#38c3ea', // water
  5: '#86e3f7', // water highlight / foam
  6: '#a4f07a', // land edge (más claro que el pasto)
  7: '#cdb877', // shore edge
}

export const ENVIRONMENTS: Record<EnvironmentKey, Environment> = {
  terrestrial: {
    name: 'Terrícola',
    terrain: { 1: '#5fc531', 2: '#79d94a', 3: '#efe1a0', 4: '#38c3ea', 5: '#86e3f7', 6: '#a4f07a', 7: '#cdb877' },
    recolor: {},
    decoration: 'tree',
    glow: 'rgba(255,255,255,.0)',
  },
  alien: {
    name: 'Alienígena',
    terrain: { 1: '#2f7f57', 2: '#45a36e', 3: '#79f0d0', 4: '#2c2f9c', 5: '#5ff3e6', 6: '#7fd9a6', 7: '#3fbfa0' },
    recolor: { B: 'C', b: 'p', O: 'P', Y: 'p', R: 'C', E: 'C', e: 'p' },
    decoration: 'mushroom',
    glow: 'rgba(95,243,230,.35)',
  },
  futuristic: {
    name: 'Futurista',
    terrain: { 1: '#6f7a88', 2: '#818d9b', 3: '#63e6ff', 4: '#1e8fd8', 5: '#9df0ff', 6: '#b6c1cf', 7: '#2fb3d9' },
    recolor: { E: 'C', e: 'b', R: 'O', r: 'Y' },
    decoration: 'pylon',
    glow: 'rgba(99,230,255,.35)',
  },
}

const S = (rows: string[]) => rows

export const SPRITES: Record<string, string[]> = {
  // ─── Renovables ───
  wind: S([
    '.......KK.......',
    '......KWWK......',
    '......KWWK......',
    '......KWWK......',
    '.....KWWWWK.....',
    '....KWWKKWWK....',
    '...KWWK..KWWK...',
    '..KWWK....KWWK..',
    '.KWWK..KK..KWWK.',
    '.KKK..KGGK..KKK.',
    '......KGGK......',
    '......KGGK......',
    '......KGGK......',
    '.....KGGGGK.....',
    '....KDDDDDDK....',
    '....KKKKKKKK....',
  ]),
  solar: S([
    '................',
    '..KKKKKKKKKKKK..',
    '.KbBBbBBbBBbBBK.',
    '.KBBBBBBBBBBBBK.',
    '.KKKKKKKKKKKKKK.',
    '.KbBBbBBbBBbBBK.',
    '.KBBBBBBBBBBBBK.',
    '.KKKKKKKKKKKKKK.',
    '.KbBBbBBbBBbBBK.',
    '.KBBBBBBBBBBBBK.',
    '..KKKKKKKKKKKK..',
    '.......KGK......',
    '.......KGK......',
    '......KGGGK.....',
    '.....KDDDDDK....',
    '.....KKKKKKK....',
  ]),
  battery: S([
    '................',
    '...KKK....KKK...',
    '...KLK....KLK...',
    '.KKKKKKKKKKKKKK.',
    '.KLLLLLLLLLLLLK.',
    '.KLGGGGGGGGGGLK.',
    '.KLGGGGGYYGGGLK.',
    '.KLGGGGYYGGGGLK.',
    '.KLGGGYYYYYGGLK.',
    '.KLGGGGGGYYGGLK.',
    '.KLGGGGGGYGGGLK.',
    '.KLGGGGGGGGGGLK.',
    '.KLEEEEELLLLLLK.',
    '.KDDDDDDDDDDDDK.',
    '.KKKKKKKKKKKKKK.',
    '................',
  ]),
  controller: S([
    '.......KK.......',
    '......KCCK......',
    '.......KK.......',
    '.......KK.......',
    '..KKKKKKKKKKKK..',
    '.KGGGGGGGGGGGGK.',
    '.KGKKKKKKKKKKGK.',
    '.KGKBbbBbbBbKGK.',
    '.KGKBBBBBBBBKGK.',
    '.KGKKKKKKKKKKGK.',
    '.KGGGGGGGGGGGGK.',
    '.KGEEGGGGGGGRGK.',
    '.KGGGGGGGGGGGGK.',
    '.KDDDDDDDDDDDDK.',
    '.KKKKKKKKKKKKKK.',
    '................',
  ]),
  // ─── Reactores ───
  core: S([
    '......KKKK......',
    '....KKDDDDKK....',
    '...KDDGGGGDDK...',
    '..KDGGKKKKGGDK..',
    '.KDGGKOOOOKGGDK.',
    '.KDGKOYYYYOKGDK.',
    'KDGGKOYRRYOKGGDK',
    'KDGGKOYRRYOKGGDK',
    'KDGGKOYRRYOKGGDK',
    'KDGGKOYRRYOKGGDK',
    '.KDGKOYYYYOKGDK.',
    '.KDGGKOOOOKGGDK.',
    '..KDGGKKKKGGDK..',
    '...KDDGGGGDDK...',
    '....KKDDDDKK....',
    '......KKKK......',
  ]),
  thorium: S([
    '......KKKK......',
    '....KKDDDDKK....',
    '...KDDGGGGDDK...',
    '..KDGKKKKKKGDK..',
    '.KDGKEeeeeEKGDK.',
    '.KDGKeYYYYeKGDK.',
    'KDGGKeYOOYeKGGDK',
    'KDGGKeYOOYeKGGDK',
    'KDGGKeYOOYeKGGDK',
    'KDGGKeYOOYeKGGDK',
    '.KDGKeYYYYeKGDK.',
    '.KDGKEeeeeEKGDK.',
    '..KDGKKKKKKGDK..',
    '...KDDGGGGDDK...',
    '....KKDDDDKK....',
    '......KKKK......',
  ]),
  fusion: S([
    '.....KKKKKK.....',
    '...KKDDDDDDKK...',
    '..KDDKKKKKKDDK..',
    '.KDDKPPppppPKDDK',
    '.KDKPpCCCCCCpKDK',
    'KDDKPCCWWWWCCKDD',
    'KDDKpCWWppWWCKDD',
    'KDDKpCWppppWCKDD',
    'KDDKpCWppppWCKDD',
    'KDDKpCWWppWWCKDD',
    'KDDKPCCWWWWCCKDD',
    '.KDKPpCCCCCCpKDK',
    '.KDDKPPppppPKDDK',
    '..KDDKKKKKKDDK..',
    '...KKDDDDDDKK...',
    '.....KKKKKK.....',
  ]),
  // ─── Red térmica ───
  generator: S([
    '...LL...........',
    '..LL.KK.........',
    '.....KGGK.......',
    '....KGGGGK......',
    '....KGGGGKKKKKK.',
    '....KGGGGKRRRRK.',
    '.KKKKGGGGKRRRRK.',
    '.KLLLLLLLLLLLLK.',
    '.KLLLLLLLLLLLLK.',
    '.KLYYLLLLLLbbLK.',
    '.KLYYYLLLLLbbLK.',
    '.KLLYYLLLLLLLLK.',
    '.KLLLLLLKKKLLLK.',
    '.KLLLLLLKDKLLLK.',
    '.KDDDDDDKDKDDDK.',
    '.KKKKKKKKKKKKKK.',
  ]),
  cooler: S([
    '....LL..LL......',
    '...LL....LL.....',
    '....KKKKKKKK....',
    '...KWWWWWWWWK...',
    '...KWLLLLLLWK...',
    '....KWLLLLWK....',
    '.....KWLLWK.....',
    '.....KWLLWK.....',
    '.....KWLLWK.....',
    '....KWWLLWWK....',
    '...KWWLLLLWWK...',
    '..KWWLLLLLLWWK..',
    '..KWLLLLLLLLWK..',
    '..KDDDDDDDDDDK..',
    '..KKKKKKKKKKKK..',
    '................',
  ]),
  exchanger: S([
    '................',
    '..KKKKKKKKKKKK..',
    '.KLLLLLLLLLLLLK.',
    '.KLKKKKKKKKKKLK.',
    'KKLKOOOOOOOOKLKK',
    'KOLKOOOOOOOOKLOK',
    'KKLKKKKKKKKKKLKK',
    '.KLKbbbbbbbbKLK.',
    'KKLKbbbbbbbbKLKK',
    'KbLKKKKKKKKKKLbK',
    'KKLKOOOOOOOOKLKK',
    '.KLKOOOOOOOOKLK.',
    '.KLKKKKKKKKKKLK.',
    '.KLLLLLLLLLLLLK.',
    '..KKKKKKKKKKKK..',
    '................',
  ]),
  pipe: S([
    '.....KKKKKK.....',
    '.....KGLLGK.....',
    '.....KGLLGK.....',
    '.....KGLLGK.....',
    '.....KGLLGK.....',
    'KKKKKKGLLGKKKKKK',
    'KGGGGGGLLGGGGGGK',
    'KLLLLLLOOLLLLLLK',
    'KLLLLLLOOLLLLLLK',
    'KGGGGGGLLGGGGGGK',
    'KKKKKKGLLGKKKKKK',
    '.....KGLLGK.....',
    '.....KGLLGK.....',
    '.....KGLLGK.....',
    '.....KGLLGK.....',
    '.....KKKKKK.....',
  ]),
  accumulator: S([
    '................',
    '....KKKKKKKK....',
    '...KRRRRRRRRK...',
    '..KRRrrRRRRRRK..',
    '..KRRrrRRRRRRK..',
    '..KKKKKKKKKKKK..',
    '..KRRrrRRRRRRK..',
    '..KRRrrRRRRRRK..',
    '..KRRrrRRRRRRK..',
    '..KKKKKKKKKKKK..',
    '..KRRrrRRRRRRK..',
    '..KRRrrRRRRRRK..',
    '...KRRRRRRRRK...',
    '....KKKKKKKK....',
    '...KDK....KDK...',
    '...KKK....KKK...',
  ]),
  // ─── Propuestas (aún no existen en el motor) ───
  sales: S([
    '................',
    '......KKKK......',
    '.....KYYYYK.....',
    '.....KYDDYK.....',
    '....KKKKKKKK....',
    '...KRRRRRRRRK...',
    '..KRRRRRRRRRRK..',
    '.KRRRRRRRRRRRRK.',
    '.KKKKKKKKKKKKKK.',
    '.KWWWWWWWWWWWWK.',
    '.KWbbWWWWWWbbWK.',
    '.KWbbWWKKKWbbWK.',
    '.KWWWWWKTKWWWWK.',
    '.KWWWWWKTKWWWWK.',
    '.KDDDDDDDDDDDDK.',
    '.KKKKKKKKKKKKKK.',
  ]),
  research: S([
    '..........KK....',
    '.........KWWK...',
    '..........KK....',
    '..........K.....',
    '.KKKKKKKKKKKKKK.',
    '.KLLLLLLLLLLLLK.',
    '.KLBbLBbLBbLBLK.',
    '.KLBBLBBLBBLBLK.',
    '.KLLLLLLLLLLLLK.',
    '.KLBbLBbLBbLBLK.',
    '.KLBBLBBLBBLBLK.',
    '.KLLLLLLLLLLLLK.',
    '.KLLLLLKKKLLLLK.',
    '.KLLLLLKDKLLLLK.',
    '.KDDDDDKDKDDDDK.',
    '.KKKKKKKKKKKKKK.',
  ]),
  insulator: S([
    '................',
    '.KKKKKKKKKKKKKK.',
    '.KLLLLLLLLLLLLK.',
    '.KLKKKKKKKKKKLK.',
    '.KLKGGGGGGGGKLK.',
    '.KLKGLGGGGLGKLK.',
    '.KLKGGGGGGGGKLK.',
    '.KLKGGGLLGGGKLK.',
    '.KLKGGGLLGGGKLK.',
    '.KLKGGGGGGGGKLK.',
    '.KLKGLGGGGLGKLK.',
    '.KLKGGGGGGGGKLK.',
    '.KLKKKKKKKKKKLK.',
    '.KLLLLLLLLLLLLK.',
    '.KKKKKKKKKKKKKK.',
    '................',
  ]),
  // ─── Decoración por ambiente ───
  tree: S([
    '................',
    '................',
    '......KKKK......',
    '....KKEEEEKK....',
    '...KEeEEEEEEK...',
    '..KEeEEEEEEEEK..',
    '..KEEEEEEEgEEK..',
    '..KKEEEEEgggKK..',
    '...KEEEEEEEgK...',
    '....KKEEEEKK....',
    '......KKKK......',
    '......KTTK......',
    '......KTTK......',
    '.....KTTTTK.....',
    '.....KKKKKK.....',
    '................',
  ]),
  mushroom: S([
    '................',
    '................',
    '.....KKKKKK.....',
    '...KKPPpPPPKK...',
    '..KPPpPPPPPpPK..',
    '..KPPPPpPPPPPK..',
    '..KCPPPPPPPCPK..',
    '..KKKKKKKKKKKK..',
    '.....KppppK.....',
    '.....KppppK.....',
    '.....KpCppK.....',
    '.....KppppK.....',
    '....KppppppK....',
    '....KKKKKKKK....',
    '................',
    '................',
  ]),
  pylon: S([
    '................',
    '......KKKK......',
    '.....KCCCCK.....',
    '.....KCbbCK.....',
    '......KKKK......',
    '......KLLK......',
    '......KLCK......',
    '......KLLK......',
    '......KLCK......',
    '......KLLK......',
    '.....KLLLLK.....',
    '....KDDDDDDK....',
    '....KKKKKKKK....',
    '................',
    '................',
    '................',
  ]),
  rock: S([
    '................',
    '................',
    '................',
    '................',
    '.......KK.......',
    '......KDDK......',
    '.....KDGGDK.....',
    '....KDGGGGDK....',
    '...KDGGDGGGDK...',
    '..KDGGGDDGGGDK..',
    '.KDGGGGDDGGGGDK.',
    '.KDDDDDDDDDDDDK.',
    '.KKKKKKKKKKKKKK.',
    '................',
    '................',
    '................',
  ]),
  // ─── Iconos de interfaz ───
  'icon-coin': S([
    '................',
    '.....KKKKKK.....',
    '....KYYYYYYK....',
    '...KYYYYYYYYK...',
    '..KYYYKKKKYYYK..',
    '..KYYKOOOOKYYK..',
    '..KYYKOOOOKYYK..',
    '..KYYKOOOOKYYK..',
    '..KYYKOOOOKYYK..',
    '..KYYKOOOOKYYK..',
    '..KYYYKKKKYYYK..',
    '...KYYYYYYYYK...',
    '....KYYYYYYK....',
    '.....KKKKKK.....',
    '................',
    '................',
  ]),
  'icon-bolt': S([
    '................',
    '.......KKK......',
    '......KYYK......',
    '.....KYYK.......',
    '.....KYYK.......',
    '....KYYK........',
    '....KYYKKKK.....',
    '...KYYYYYYK.....',
    '...KKKKYYK......',
    '......KYYK......',
    '.....KYYK.......',
    '.....KYYK.......',
    '....KYYK........',
    '....KYK.........',
    '....KK..........',
    '................',
  ]),
  'icon-flask': S([
    '................',
    '.....KKKKKK.....',
    '.....KLLLLK.....',
    '......KLLK......',
    '......KLLK......',
    '......KLLK......',
    '......KLLK......',
    '.....KLLLLK.....',
    '....KLLLLLLK....',
    '...KLLCCCCLLK...',
    '..KLCCCCCCCCLK..',
    '..KCCCCCCCCCCK..',
    '..KCCCCCCCCCCK..',
    '...KCCCCCCCCK...',
    '....KKKKKKKK....',
    '................',
  ]),
  'icon-flame': S([
    '................',
    '.......K........',
    '......KOK.......',
    '......KOK.......',
    '.....KOOK.......',
    '.....KOOOK......',
    '....KOOOOK..K...',
    '....KOYOOOKKOK..',
    '...KOYYYOOOOOK..',
    '...KOYYYYOOOOK..',
    '...KOYYYYYOOK...',
    '...KOOYYYYOOK...',
    '....KOOYYOOK....',
    '.....KOOOOK.....',
    '......KKKK......',
    '................',
  ]),
  'icon-hammer': S([
    '................',
    '....KKKKKKK.....',
    '...KGGGGGGGK....',
    '...KGLLGGGGK....',
    '...KGGGGGGGK....',
    '....KKKKKKK.....',
    '......KTTK......',
    '......KTTK......',
    '......KTTK......',
    '......KTTK......',
    '......KTTK......',
    '......KTTK......',
    '......KTTK......',
    '......KTTK......',
    '.......KK.......',
    '................',
  ]),
  'icon-magnifier': S([
    '................',
    '....KKKKK.......',
    '...KLbbbLK......',
    '..KLbWWbbLK.....',
    '..KbWbbbbbK.....',
    '..KbbbbbbbK.....',
    '..KbbbbbbbK.....',
    '..KLbbbbbLK.....',
    '...KLbbbLK......',
    '....KKKKKKK.....',
    '.........KDDK...',
    '..........KDDK..',
    '...........KDDK.',
    '............KDK.',
    '.............K..',
    '................',
  ]),
  'icon-scroll': S([
    '................',
    '...KKKKKKKKK....',
    '..KtWWWWWWWtK...',
    '..KtWKKKKKWtK...',
    '..KtWWWWWWWtK...',
    '..KtWKKKKKWtK...',
    '..KtWWWWWWWtK...',
    '..KtWKKKKKWtK...',
    '..KtWWWWWWWtK...',
    '..KtWKKKWWWtK...',
    '..KtWWWWWWWtK...',
    '..KtWWWWWWWtK...',
    '..KKtWWWWWtKK...',
    '...KKKKKKKKK....',
    '................',
    '................',
  ]),
  'icon-menu': S([
    '................',
    '................',
    '..KKKKKKKKKKKK..',
    '..KLLLLLLLLLLK..',
    '..KKKKKKKKKKKK..',
    '................',
    '..KKKKKKKKKKKK..',
    '..KLLLLLLLLLLK..',
    '..KKKKKKKKKKKK..',
    '................',
    '..KKKKKKKKKKKK..',
    '..KLLLLLLLLLLK..',
    '..KKKKKKKKKKKK..',
    '................',
    '................',
    '................',
  ]),
  'icon-undo': S([
    '................',
    '................',
    '.....K..........',
    '....KLK.........',
    '...KLLKKKKKK....',
    '..KLLLLLLLLLK...',
    '...KLLKKKKKLLK..',
    '....KLK....KLK..',
    '.....K.....KLK..',
    '...........KLK..',
    '..........KLK...',
    '.......KKKLLK...',
    '.......KLLLK....',
    '.......KKKK.....',
    '................',
    '................',
  ]),
  'icon-trash': S([
    '................',
    '......KKKK......',
    '..KKKKKRRKKKKK..',
    '..KRRRRRRRRRRK..',
    '..KKKKKKKKKKKK..',
    '...KRRRRRRRRK...',
    '...KRKRKRKRRK...',
    '...KRKRKRKRRK...',
    '...KRKRKRKRRK...',
    '...KRKRKRKRRK...',
    '...KRKRKRKRRK...',
    '...KRRRRRRRRK...',
    '...KRRRRRRRRK...',
    '....KKKKKKKK....',
    '................',
    '................',
  ]),
  'icon-lock': S([
    '................',
    '.....KKKKKK.....',
    '....KGGGGGGK....',
    '....KGKKKKGK....',
    '....KGK..KGK....',
    '....KGK..KGK....',
    '..KKKKKKKKKKKK..',
    '..KYYYYYYYYYYK..',
    '..KYYYYKKYYYYK..',
    '..KYYYYKKYYYYK..',
    '..KYYYYYKYYYYK..',
    '..KYYYYYYYYYYK..',
    '..KYYYYYYYYYYK..',
    '..KKKKKKKKKKKK..',
    '................',
    '................',
  ]),
  'icon-power': S([
    '................',
    '.......KK.......',
    '......KEEK......',
    '....KKKEEKKK....',
    '...KEEKEEKEEK...',
    '..KEEK.EE.KEEK..',
    '..KEK..EE..KEK..',
    '..KEK..KK..KEK..',
    '..KEK......KEK..',
    '..KEEK....KEEK..',
    '...KEEK..KEEK...',
    '....KEEKKEEK....',
    '.....KEEEEK.....',
    '......KKKK......',
    '................',
    '................',
  ]),
  // ─── Terreno ───
  land: S([
    '1111111111111111',
    '1112111111121111',
    '1111111111111111',
    '1111111211111111',
    '1121111111111211',
    '1111111111111111',
    '1111112111111111',
    '1111111111121111',
    '1211111111111111',
    '1111111121111111',
    '1111111111111112',
    '1112111111111111',
    '1111111111211111',
    '1111121111111111',
    '1111111111111211',
    '1111111111111111',
  ]),
  shore: S([
    '3333333333333333',
    '3333333333333333',
    '3333333333333333',
    '3333333333333333',
    '3333333333333333',
    '3333333333333333',
    '3333333333333333',
    '3333333333333333',
    '3333333333333333',
    '3333333333333333',
    '3333333333333333',
    '3333333333333333',
    '3333333333333333',
    '3333333333333333',
    '3333333333333333',
    '3333333333333333',
  ]),
  water: S([
    '4444444444444444',
    '4455444444444444',
    '4444444444455444',
    '4444444444444444',
    '4444444444444444',
    '4444445544444444',
    '4444444444444444',
    '4444444444444444',
    '4554444444444455',
    '4444444444444444',
    '4444444444444444',
    '4444444455444444',
    '4444444444444444',
    '4445544444444444',
    '4444444444444444',
    '4444444444444444',
  ]),
}

export const COMPONENT_SPRITES: string[] = ['wind', 'solar', 'battery', 'controller', 'core', 'thorium', 'fusion', 'generator', 'cooler', 'exchanger', 'pipe', 'accumulator']
export const PROPOSED_SPRITES: string[] = ['sales', 'research', 'insulator']

export function validate(): void {
  for (const [name, rows] of Object.entries(SPRITES)) {
    if (rows.length !== 16) throw new Error(`${name}: ${rows.length} filas`)
    rows.forEach((row, y) => {
      if (row.length !== 16) throw new Error(`${name} fila ${y}: ${row.length} columnas`)
      for (const ch of row) if (ch !== '.' && !(ch in PALETTE)) throw new Error(`${name} fila ${y}: color desconocido "${ch}"`)
    })
  }
}

/** Convierte filas ASCII a SVG. `env` aplica recolor y paleta de terreno. */
export interface SvgOptions { size?: number; cssVars?: boolean; className?: string }

export function rowsToRects(rows: string[], env: Environment = ENVIRONMENTS.terrestrial, cssVars = false): string {
  const colorOf = (ch: string) => {
    if (cssVars) return `var(--px-${ch})`
    if (ch in env.terrain) return env.terrain[ch]
    const mapped = env.recolor[ch] ?? ch
    return PALETTE[mapped as PaletteKey]
  }
  const rects: string[] = []
  rows.forEach((row, y) => {
    let x = 0
    while (x < 16) {
      const ch = row[x]
      if (ch === '.') { x++; continue }
      let w = 1
      while (x + w < 16 && row[x + w] === ch) w++
      rects.push(`<rect x="${x}" y="${y}" width="${w}" height="1" fill="${colorOf(ch)}"/>`)
      x += w
    }
  })
  return rects.join('')
}

export function rowsToSvg(rows: string[], env: Environment = ENVIRONMENTS.terrestrial, { size = 16, cssVars = false, className = '' }: SvgOptions = {}): string {
  const cls = className ? ` class="${className}"` : ''
  return `<svg xmlns="http://www.w3.org/2000/svg"${cls} viewBox="0 0 16 16" width="${size}" height="${size}" shape-rendering="crispEdges">${rowsToRects(rows, env, cssVars)}</svg>`
}

/** Convierte un sprite con nombre a SVG. */
export function toSvg(name: string, env?: Environment, opts?: SvgOptions): string {
  const rows = SPRITES[name]
  if (!rows) throw new Error(`sprite desconocido: ${name}`)
  return rowsToSvg(rows, env, opts)
}

// ─── Autotiling de terreno ───
// La tierra siempre se dibuja entera (las casillas construibles no pierden
// píxeles). La playa vive en los tiles de AGUA que tocan tierra: una franja de
// arena con costa ondulada en cada lado que da a tierra, un bulto redondeado en
// las esquinas diagonales, línea clara contra el pasto y espuma hacia el agua.
// El pasto también asoma 1–2 px de forma irregular dentro de la franja para que
// el límite pasto/arena no sea una recta.
export const TERRAIN_KINDS: TerrainKind[] = ['water', 'land']
// Ondulaciones a lo largo de un lado (empiezan y terminan igual para que sean
// continuas entre tiles vecinos).
const COAST = [2, 2, 3, 3, 2, 2, 3, 3, 3, 2, 2, 3, 3, 2, 2, 2]
const GRASS = [1, 1, 2, 2, 1, 0, 0, 1, 2, 2, 1, 0, 1, 2, 1, 1]
const BEACH_WIDTH = 3
const CORNER_RADIUS = 4.5
const SIDES = ['n', 'e', 's', 'w'] as const
const CORNERS: Record<string, [string, string]> = { nw: ['n', 'w'], ne: ['n', 'e'], sw: ['s', 'w'], se: ['s', 'e'] }

type Pixel = 'land' | 'grass' | 'sand' | 'water'

/**
 * Devuelve las filas ASCII del tile `kind` según sus vecinos.
 * `neighbors` = { n, e, s, w, ne, nw, se, sw } con el terreno vecino (agua si falta).
 */
export function terrainRows(kind: TerrainKind, neighbors: Neighbors = {}): string[] {
  if (kind !== 'water') return SPRITES[kind]
  const land = (k: string) => neighbors[k as keyof Neighbors] === 'land'
  if (![...SIDES, ...Object.keys(CORNERS)].some(land)) return SPRITES.water
  const depth = (i: number) => BEACH_WIDTH + COAST[i]
  const inCorner = (x: number, y: number) => (x + 0.5) ** 2 + (y + 0.5) ** 2 < CORNER_RADIUS ** 2
  const isGrass = (x: number, y: number): boolean => {
    if (land('n') && y < GRASS[x]) return true
    if (land('s') && y >= 16 - GRASS[x]) return true
    if (land('w') && x < GRASS[y]) return true
    if (land('e') && x >= 16 - GRASS[y]) return true
    return false
  }
  const isSand = (x: number, y: number): boolean => {
    if (land('n') && y < depth(x)) return true
    if (land('s') && y >= 16 - depth(x)) return true
    if (land('w') && x < depth(y)) return true
    if (land('e') && x >= 16 - depth(y)) return true
    if (land('nw') && !land('n') && !land('w') && inCorner(x, y)) return true
    if (land('ne') && !land('n') && !land('e') && inCorner(15 - x, y)) return true
    if (land('sw') && !land('s') && !land('w') && inCorner(x, 15 - y)) return true
    if (land('se') && !land('s') && !land('e') && inCorner(15 - x, 15 - y)) return true
    return false
  }
  const inside = (x: number, y: number): Pixel => (isGrass(x, y) ? 'grass' : isSand(x, y) ? 'sand' : 'water')
  // Más allá del borde del tile: tierra, o lo mismo que el píxel del borde.
  const beyond = (x: number, y: number, side: string): Pixel => land(side) ? 'land' : inside(Math.min(15, Math.max(0, x)), Math.min(15, Math.max(0, y)))
  const at = (x: number, y: number): Pixel => {
    if (y < 0) return beyond(x, y, 'n')
    if (y > 15) return beyond(x, y, 's')
    if (x < 0) return beyond(x, y, 'w')
    if (x > 15) return beyond(x, y, 'e')
    return inside(x, y)
  }
  const rows: string[] = []
  for (let y = 0; y < 16; y++) {
    let row = ''
    for (let x = 0; x < 16; x++) {
      const pixel = inside(x, y)
      const around = [at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)]
      if (pixel === 'grass') row += '1'
      else if (pixel === 'sand') row += around.includes('land') || around.includes('grass') ? '6' : around.includes('water') ? '7' : '3'
      else row += around.includes('sand') ? '5' : SPRITES.water[y][x]
    }
    rows.push(row)
  }
  return rows
}

/** Declaraciones CSS `--px-X` para un ambiente (usadas con `cssVars: true`). */
export function envCssVars(env: Environment): string {
  const decls: string[] = []
  for (const ch of Object.keys(PALETTE)) {
    const color = ch in env.terrain ? env.terrain[ch] : PALETTE[(env.recolor[ch] ?? ch) as PaletteKey]
    decls.push(`--px-${ch}:${color}`)
  }
  return decls.join(';')
}

export function toDataUri(name: string, env?: Environment, opts?: SvgOptions): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(toSvg(name, env, opts))}`
}
