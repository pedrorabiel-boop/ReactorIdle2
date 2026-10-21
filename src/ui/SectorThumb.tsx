import { CORAL_ENVIRONMENT } from './pixel/coral'
import { CYBERPUNK_ENVIRONMENT } from './pixel/cyberpunk'
import { NUKETOWN_ENVIRONMENT } from './pixel/nuketown'
import type { Environment } from './pixel/sprites'
import type { SectorKey } from '../game/types'

/**
 * Miniatura del terreno de cada sector.
 *
 * Los digitos no son colores: son las mismas ocho ranuras de terreno que usa
 * el mapa de verdad, resueltas contra el bioma. Asi la miniatura no puede
 * desfasarse del juego -si se repinta un bioma, su miniatura se repinta sola-
 * y las tres se leen como hermanas porque comparten la estructura de franjas.
 * Las letras son lo unico propio: el adorno que identifica a cada sector.
 */
interface Thumb { env: Environment; extra: Record<string, string>; rows: string[] }

const THUMBS: Record<SectorKey, Thumb> = {
  coast: {
    env: CORAL_ENVIRONMENT,
    extra: { F: '#2f8f2a', P: '#8a5a2b' }, // palmera
    rows: [
      '4444444444444444',
      '4445444444544444',
      '5555555555555555',
      '8888888888888888',
      '7777777777777777',
      '3333333333333333',
      '333333FFF3333333',
      '33333FFPFF333333',
      '111111PP11111111',
      '121111PP11111161',
      '1111111111111111',
      '1611111111112111',
    ],
  },
  desert: {
    env: CYBERPUNK_ENVIRONMENT,
    extra: { C: '#5c8f42', T: '#14201a', R: '#14201a' }, // manglar y sus raices
    rows: [
      '4444444444444444',
      '4444544444444444',
      '4444444444544444',
      '8888888888888888',
      '3333333333333333',
      '1111CCCCCCC11111',
      '111CCCCCCCCC1111',
      '11111CCCCC111111',
      '1111111T11111111',
      '116111TTT1111111',
      '11111RT1TR111121',
      '1111111111111111',
    ],
  },
  testsite: {
    env: NUKETOWN_ENVIRONMENT,
    extra: { C: '#4f7a3e' }, // cactus
    rows: [
      '4444444444444444',
      '4454444444544444',
      '5555555555555555',
      '7777777777777777',
      '3333333333333333',
      '1111111111111111',
      '111111C1C1111111',
      '111111CCC1111111',
      '1111111C11111161',
      '1611111C11112111',
      '1111111C11111111',
      '1111111111111111',
    ],
  },
}

/** Una <path> por color, como el resto del arte del juego. */
function paths(thumb: Thumb) {
  const porColor = new Map<string, string[]>()
  thumb.rows.forEach((row, y) => {
    let x = 0
    while (x < row.length) {
      const ch = row[x]
      let ancho = 1
      while (x + ancho < row.length && row[x + ancho] === ch) ancho += 1
      const fill = thumb.extra[ch] ?? thumb.env.terrain[ch as keyof Environment['terrain']]
      if (fill) {
        if (!porColor.has(fill)) porColor.set(fill, [])
        porColor.get(fill)!.push(`M${x} ${y}h${ancho}v1h-${ancho}z`)
      }
      x += ancho
    }
  })
  return [...porColor]
}

export function SectorThumb({ sector, size = 46 }: { sector: SectorKey; size?: number }) {
  const thumb = THUMBS[sector]
  return <svg className="sector-thumb" viewBox="0 0 16 12" width={size} height={size * 12 / 16} shapeRendering="crispEdges" aria-hidden="true">
    {paths(thumb).map(([fill, d]) => <path key={fill} fill={fill} d={d.join('')} />)}
  </svg>
}
