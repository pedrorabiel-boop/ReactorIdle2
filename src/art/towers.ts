import { draw, stamp } from './forge'

// ─────────────────────────────────────────────────────────────────────────────
// Las torres redibujadas a 32x32.
//
// Cada una respeta la silueta y los colores de la de hoy -el jugador tiene que
// seguir reconociendolas- y gasta los pixeles nuevos en lo que a 16 no cabia:
// contorno de 1 px, biseles, y detalle de superficie.
// ─────────────────────────────────────────────────────────────────────────────

/** Caja con marco claro y panel interior: el chasis que comparten varias. */
const chassis = (c: ReturnType<typeof draw> extends infer _ ? any : never, x1: number, y1: number, x2: number, y2: number, frame: string, inner: string) => {
  c.rect(x1, y1, x2, y2, frame)
  c.rect(x1 + 2, y1 + 2, x2 - 2, y2 - 2, 'K')
  c.rect(x1 + 3, y1 + 3, x2 - 3, y2 - 3, inner)
}

export const ART: Record<string, string[]> = {
  wind: draw((c) => {
    // Mastil estrecho y zapata angosta. Van primero: las aspas quedan delante.
    c.taper(16, 13, 27, 3, 5, 'G')
    c.rect(10, 28, 22, 30, 'D')
    c.rect(11, 28, 21, 28, 'G')
    // Las tres aspas salen del buje con el mismo largo y el mismo grosor. Antes
    // las de abajo median metro y medio mas que la de arriba y la turbina se
    // veia descompensada.
    c.blade(16, 12, 16, 2, 4.2, 2.6, 'W')
    c.blade(16, 12, 7, 17, 4.2, 2.6, 'W')
    c.blade(16, 12, 25, 17, 4.2, 2.6, 'W')
    c.ellipse(16, 12, 3, 3, 'L')
    c.ellipse(16, 12, 1.4, 1.4, 'D')
  }),

  solar: draw((c) => {
    c.taper(16, 20, 26, 4, 7, 'G')
    c.rect(9, 27, 23, 30, 'D')
    c.rect(2, 1, 29, 21, 'K')
    c.rect(3, 2, 28, 20, 'B')
    // Seis filas de celdas con su junta; el canto alto de cada celda brilla.
    for (let row = 0; row < 6; row++) {
      const y = 2 + row * 3
      c.rect(3, y, 28, y, 'b')
      c.rect(3, y + 2, 28, y + 2, 'K')
    }
    for (let x = 7; x < 28; x += 5) c.rect(x, 2, x, 19, 'K')
    // Un solo destello corto en una esquina. El reflejo diagonal largo que
    // tenia antes se comia el panel entero.
    c.blade(22, 8, 27, 3, 1.6, 1.6, 'b')
  }),

  battery: draw((c) => {
    c.rect(6, 1, 10, 5, 'L')
    c.rect(21, 1, 25, 5, 'L')
    chassis(c, 1, 4, 30, 29, 'L', 'G')
    // Rayo: el simbolo que ya tenia, ahora con filo.
    c.blade(19, 7, 13, 16, 3, 3, 'Y')
    c.rect(10, 15, 21, 17, 'Y')
    c.blade(18, 16, 12, 25, 3, 3, 'Y')
    c.ellipse(16, 16, 2, 2, 'Y')
    // Barra de carga segmentada abajo.
    for (let i = 0; i < 5; i++) c.rect(5 + i * 5, 24, 8 + i * 5, 26, i < 3 ? 'E' : 'D')
  }),

  controller: draw((c) => {
    c.rect(15, 2, 17, 9, 'G')
    c.ellipse(16, 4, 2.8, 2.8, 'C')
    chassis(c, 1, 8, 30, 29, 'G', 'G')
    // Pantalla con sus lineas de datos.
    c.rect(4, 11, 27, 21, 'K')
    c.rect(5, 12, 26, 20, 'B')
    for (let y = 13; y < 20; y += 2) c.rect(6, y, 6 + ((y * 7) % 17) + 3, y, 'b')
    // Hilera de pilotos.
    c.rect(4, 24, 7, 26, 'E')
    c.rect(9, 24, 12, 26, 'E')
    c.rect(24, 24, 27, 26, 'R')
    for (let x = 14; x < 23; x += 2) c.rect(x, 25, x, 25, 'D')
  }),

  // Los tres reactores comparten carcasa. Van centrados en 15.5 y no en 16:
  // asi el disco cae justo en las columnas 1..30 y queda sitio para el contorno
  // por los cuatro lados. Centrado en 16 tocaba el borde derecho e inferior y
  // se quedaba sin negro de ese lado.
  core: draw((c) => {
    c.ellipse(15.5, 15.5, 14.5, 14.5, 'D')
    c.ellipse(15.5, 15.5, 12.5, 12.5, 'G')
    c.ellipse(15.5, 15.5, 10.5, 10.5, 'D')
    c.ellipse(15.5, 15.5, 9.5, 9.5, 'K')
    c.ellipse(15.5, 15.5, 8.5, 8.5, 'O')
    c.ellipse(15.5, 15.5, 6.2, 6.2, 'Y')
    c.ellipse(15.5, 15.5, 3.6, 3.6, 'R')
    c.ellipse(13.5, 13.5, 1.4, 1.4, 'r')
    // Pernos de la carcasa, a las cuatro esquinas.
    for (const [x, y] of [[8, 8], [23, 8], [8, 23], [23, 23]]) c.ellipse(x, y, 1.4, 1.4, 'K')
  }),

  thorium: draw((c) => {
    c.ellipse(15.5, 15.5, 14.5, 14.5, 'D')
    c.ellipse(15.5, 15.5, 12.5, 12.5, 'G')
    c.ellipse(15.5, 15.5, 10.5, 10.5, 'D')
    c.ellipse(15.5, 15.5, 9.5, 9.5, 'K')
    c.ellipse(15.5, 15.5, 8.5, 8.5, 'E')
    c.ellipse(15.5, 15.5, 6.6, 6.6, 'e')
    c.ellipse(15.5, 15.5, 4.8, 4.8, 'Y')
    c.ellipse(15.5, 15.5, 2.6, 2.6, 'O')
    for (const [x, y] of [[8, 8], [23, 8], [8, 23], [23, 23]]) c.ellipse(x, y, 1.4, 1.4, 'K')
  }),

  fusion: draw((c) => {
    c.ellipse(15.5, 15.5, 14.5, 14.5, 'D')
    c.ellipse(15.5, 15.5, 12.5, 12.5, 'K')
    c.ellipse(15.5, 15.5, 11.5, 11.5, 'P')
    c.ellipse(15.5, 15.5, 9.5, 9.5, 'p')
    c.ellipse(15.5, 15.5, 8, 8, 'C')
    c.ellipse(15.5, 15.5, 5.4, 5.4, 'W')
    // El plasma: un toroide, no un disco.
    c.ellipse(15.5, 15.5, 2.8, 2.8, 'p')
    c.ellipse(15.5, 15.5, 1.3, 1.3, 'W')
    for (const [x, y] of [[15, 3], [15, 28], [3, 15], [28, 15]]) c.ellipse(x, y, 1.6, 1.6, 'K')
  }),

  planck: draw((c) => {
    // Destello de cuatro puntas: brazos largos y afilados desde el centro.
    for (const [x, y] of [[16, 1], [16, 30], [1, 16], [30, 16]] as const) c.blade(16, 16, x, y, 7, 0.6, 'Y')
    for (const [x, y] of [[16, 1], [16, 30], [1, 16], [30, 16]] as const) c.blade(16, 16, x, y, 3.4, 0.4, 'W')
    // Diagonales cortas, para que no quede una cruz plana.
    for (const [x, y] of [[26, 6], [6, 26], [26, 26], [6, 6]] as const) c.blade(16, 16, x, y, 2.6, 0.4, 'Y')
    c.ellipse(16, 16, 4, 4, 'W')
    c.ellipse(16, 16, 2, 2, 'C')
  }),

  // Las dos turbinas vuelven a la X abstracta de la de hoy: es mas legible y
  // tiene mas contraste que el rotor de ocho palas que habia dibujado, que la
  // diluia en una estrella gris.
  // El chasis termina en la fila 30 y los bornes arrancan en la 1: llegando a
  // la 31 y a la 0 no quedaba pixel donde poner el contorno y la caja se abria
  // por abajo y por arriba.
  generator: draw((c) => {
    c.rect(6, 1, 10, 5, 'D')
    c.rect(21, 1, 25, 5, 'D')
    chassis(c, 1, 4, 30, 30, 'L', 'D')
    c.blade(6, 9, 25, 25, 4.6, 4.6, 'W')
    c.blade(25, 9, 6, 25, 4.6, 4.6, 'W')
    c.rect(13, 14, 18, 19, 'K')
    c.rect(14, 15, 17, 18, 'Y')
  }),

  // La II se distingue por el color, no por el dibujo: marco celeste, panel
  // gris y la X celeste con su cuadro central.
  generator2: draw((c) => {
    c.rect(6, 1, 10, 5, 'C')
    c.rect(21, 1, 25, 5, 'C')
    chassis(c, 1, 4, 30, 30, 'C', 'D')
    c.blade(6, 9, 25, 25, 4.6, 4.6, 'C')
    c.blade(25, 9, 6, 25, 4.6, 4.6, 'C')
    c.rect(13, 14, 18, 19, 'K')
    c.rect(14, 15, 17, 18, 'W')
  }),

  cooler: draw((c) => {
    // Torre de tiro: ancha arriba, estrecha en la cintura, ancha en la base.
    // La cintura va mas marcada que antes, que parecia un jarron.
    for (let y = 5; y <= 28; y++) {
      const t = (y - 5) / 23
      // Boca estrecha, base ancha y la cintura marcada entre las dos. Simetrico
      // quedaba como una copa; el perfil real se ensancha hacia abajo.
      const half = (8 + 4 * t) - Math.sin(Math.min(1, t * 1.3) * Math.PI) * 4.5
      c.rect(Math.round(16 - half), y, Math.round(16 + half - 1), y, 'L')
    }
    c.rect(3, 29, 28, 30, 'D')
    // Boca y sombra interior.
    c.rect(8, 5, 23, 7, 'D')
    c.rect(9, 6, 22, 7, 'G')
    // Vapor saliendo.
    for (const [x, y, r] of [[11, 4, 2.2], [17, 3, 2.6], [23, 5, 1.8]] as const) c.ellipse(x, y, r, r * 0.8, 'W')
  }),

  exchanger: draw((c) => {
    chassis(c, 1, 1, 30, 30, 'L', 'D')
    // Tres bancos de tubos: caliente, frio, caliente.
    for (const [y, color] of [[5, 'O'], [14, 'b'], [23, 'O']] as const) {
      c.rect(5, y, 26, y + 5, color)
      for (let x = 6; x < 26; x += 3) c.rect(x, y, x, y + 5, 'K')
    }
    // Colectores que asoman por los costados.
    for (const y of [6, 15, 24]) { c.rect(1, y, 4, y + 3, 'G'); c.rect(27, y, 30, y + 3, 'G') }
  }),

  // Tuberias mas delgadas: el tramo baja de 12 px de ancho a 8, y el de la II
  // de 14 a 10.
  // Los cuatro brazos arrancan en la fila/columna 1 y no en la 0: asi el
  // contorno puede cerrar la boca de cada tramo, como en las de hoy.
  pipe: draw((c) => {
    // Cruz de tuberia: tramo vertical y horizontal con su brida.
    c.rect(12, 1, 19, 30, 'G')
    c.rect(1, 12, 30, 19, 'G')
    c.rect(14, 1, 17, 30, 'L')
    c.rect(1, 14, 30, 17, 'L')
    // Bridas en las cuatro bocas.
    for (const y of [1, 28]) c.rect(11, y, 20, y + 2, 'G')
    for (const x of [1, 28]) c.rect(x, 11, x + 2, 20, 'G')
    // Nudo central caliente.
    c.ellipse(15.5, 15.5, 2.8, 2.8, 'O')
    c.ellipse(15.5, 15.5, 1.3, 1.3, 'Y')
  }),

  pipe2: draw((c) => {
    c.rect(11, 1, 20, 30, 'B')
    c.rect(1, 11, 30, 20, 'B')
    c.rect(13, 1, 18, 30, 'C')
    c.rect(1, 13, 30, 18, 'C')
    for (const y of [1, 28]) c.rect(10, y, 21, y + 2, 'B')
    for (const x of [1, 28]) c.rect(x, 10, x + 2, 21, 'B')
    c.ellipse(15.5, 15.5, 3.4, 3.4, 'W')
    c.ellipse(15.5, 15.5, 1.6, 1.6, 'C')
  }),

  accumulator: draw((c) => {
    c.rect(7, 28, 11, 30, 'D')
    c.rect(20, 28, 24, 30, 'D')
    // Tres anillos apilados, como un tanque a presion.
    for (let i = 0; i < 3; i++) {
      const y = 1 + i * 9
      c.rect(3, y, 28, y + 7, 'R')
      c.rect(5, y + 1, 9, y + 6, 'r')
      c.rect(3, y + 7, 28, y + 7, 'K')
    }
    c.rect(2, 1, 2, 27, 'R')
    c.rect(29, 1, 29, 27, 'R')
  }),

  // Vuelve a ser la casita de siempre -el camion se va-: moneda arriba, techo
  // a dos aguas, muros claros, dos ventanas con su cruceta y puerta de madera.
  sales: draw((c) => {
    c.ellipse(16, 5, 3.8, 3.8, 'Y')
    c.ellipse(16, 5, 2.4, 2.4, 'O')
    c.rect(15, 3, 16, 8, 'Y')
    for (let y = 9; y <= 17; y++) {
      const half = 2.5 + (y - 9) * 1.55
      c.rect(Math.round(16 - half), y, Math.round(16 + half - 1), y, 'R')
    }
    c.rect(2, 16, 29, 18, 'R')
    c.rect(5, 19, 26, 29, 'W')
    for (const x of [7, 19]) {
      c.rect(x, 21, x + 5, 26, 'K')
      c.rect(x + 1, 22, x + 4, 25, 'b')
      c.rect(x + 1, 23, x + 4, 23, 'K')
      c.rect(x + 2, 22, x + 2, 25, 'K')
    }
    c.rect(13, 23, 18, 29, 'T')
    c.rect(14, 24, 17, 29, 't')
    c.rect(4, 29, 27, 30, 'D')
  }),

  // Rascacielos dorado con retranqueos art deco y el signo $ en la cuspide.
  sales2: draw((c) => {
    stamp(c, 13, 1, [
      '..#..',
      '.###.',
      '##.##',
      '##...',
      '.###.',
      '...##',
      '##.##',
      '.###.',
      '..#..',
    ], 'Y', 1)
    // La base ocupa 28 px de los 32: con 20 se veia claramente mas flaca que el
    // resto de las torres. Los retranqueos son de un pixel por lado, no
    // escalones: ensanchandolos por igual se convertia en un ziguriat.
    const floors: Array<[number, number, number]> = [[8, 16, 12], [16, 23, 13], [23, 30, 14]]
    for (const [top, bottom, half] of floors) {
      c.rect(16 - half, top, 16 + half - 1, bottom, 'Y')
      c.rect(16 - half, top, 16 + half - 1, top, 'O')
      // Ventanas en franjas verticales, cortadas por las plantas: las franjas
      // enteras le daban aire de columnata, y la cuadricula le devuelve la
      // verticalidad sin que parezca un templo.
      for (let x = 17 - half; x < 15 + half; x += 4) {
        for (let y = top + 2; y <= bottom - 1; y += 3) c.rect(x, y, x + 1, Math.min(y + 1, bottom - 1), 'T')
      }
    }
    // Juntas entre pisos, para que no se lea como un unico bloque.
    for (const [, bottom] of floors) c.rect(16 - 14, bottom, 16 + 13, bottom, 'O')
  }),

  // Laboratorio: bloque bajo y ancho, azotea con ductos de extraccion, banda
  // de ventanas iluminadas y entrada central con escalinata.
  research: draw((c) => {
    c.rect(5, 2, 9, 9, 'G')
    c.rect(6, 1, 8, 2, 'D')
    c.rect(22, 4, 26, 9, 'G')
    c.rect(23, 3, 25, 4, 'D')
    c.rect(1, 9, 30, 30, 'L')
    c.rect(1, 9, 30, 11, 'G')
    // Ventanas en el azul oscuro de siempre y puerta en gris oscuro: el cian
    // claro que les habia puesto se comia el contraste contra la fachada.
    for (let row = 0; row < 2; row++) for (let col = 0; col < 5; col++) {
      const x = 3 + col * 6, y = 14 + row * 6
      c.rect(x, y, x + 3, y + 3, 'K')
      c.rect(x, y, x + 3, y + 2, 'B')
      c.rect(x, y, x + 3, y, 'b')
    }
    c.rect(12, 25, 19, 30, 'K')
    c.rect(13, 26, 18, 30, 'D')
    c.rect(10, 29, 21, 30, 'G')
  }),

  // Edificio con el matraz erlenmeyer como emblema en la fachada.
  research2: draw((c) => {
    // Fondo negro, como en la de hoy: contra el gris oscuro el matraz se perdia.
    chassis(c, 1, 1, 30, 30, 'L', 'K')
    // Boca y cuello.
    c.rect(12, 5, 19, 7, 'W')
    c.rect(14, 7, 17, 11, 'W')
    // Cono del cuerpo, y debajo un casquete que le redondea el fondo.
    for (let y = 11; y <= 21; y++) {
      const half = 2 + (y - 11) * 0.76
      c.rect(Math.round(15.5 - half), y, Math.round(15.5 + half - 1), y, 'W')
    }
    c.ellipse(15.5, 21, 10.2, 5.2, 'W')
    // El liquido llena el fondo redondeado y sube un poco por el cono.
    c.ellipse(15.5, 21.2, 9, 4.2, 'C')
    for (let y = 17; y <= 21; y++) {
      const half = 1 + (y - 11) * 0.76
      c.rect(Math.round(15.5 - half), y, Math.round(15.5 + half - 1), y, 'C')
    }
    c.ellipse(13, 21, 1.2, 1.2, 'W')
    c.ellipse(19, 23, 1, 1, 'W')
  }),

  insulator: draw((c) => {
    chassis(c, 1, 1, 30, 30, 'L', 'G')
    // Acolchado: un relieve de rombos repetido.
    for (let y = 6; y < 27; y += 5) for (let x = 6; x < 27; x += 5) {
      c.ellipse(x, y, 2, 2, 'L')
      c.ellipse(x, y, 0.8, 0.8, 'D')
    }
  }),
}
