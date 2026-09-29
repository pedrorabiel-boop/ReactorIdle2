import type { TechKey } from '../game/types'

/**
 * Música por capas. Las cinco pistas son la misma interpretación separada por
 * instrumentos y duran exactamente lo mismo, así que suenan a la vez sobre el
 * mismo reloj de audio y no pueden desincronizarse. Desbloquear una capa solo
 * sube su volumen: nunca se arranca ni se detiene nada por separado.
 */
export interface MusicLayer {
  id: string
  file: string
  /** Tecnología que la incorpora; la capa base no tiene ninguna. */
  tech?: TechKey
  name: string
  /**
   * Corrección de nivel. Las pistas no vienen igualadas entre sí: medidas en
   * RMS, la base queda 14 dB por debajo de las cuerdas y se pierde del todo.
   * Aquí solo se suben las bajas; ninguna se atenúa.
   */
  gain: number
}

export const MUSIC_LAYERS: MusicLayer[] = [
  { id: 'a', file: 'nucleus-a.mp3', name: 'Base', gain: 3 },
  { id: 'b', file: 'nucleus-b.mp3', tech: 'solar', name: 'Captación solar', gain: 1.6 },
  { id: 'c', file: 'nucleus-c.mp3', tech: 'thorium', name: 'Ciclo de torio', gain: 1 },
  { id: 'd', file: 'nucleus-d.mp3', tech: 'expansion', name: 'Expansión territorial', gain: 1 },
  { id: 'e', file: 'nucleus-e.mp3', tech: 'fusion', name: 'Confinamiento de fusión', gain: 1 },
]

const STORAGE_KEY = 'nucleus-idle-music'
const MASTER_VOLUME = 0.5
const FADE_SECONDS = 3
/**
 * Las pistas son mono a 64 kbps, que no puede llevar nada por encima de unos
 * 12 kHz. Decodificar a 24 kHz conserva todo lo que hay y ocupa la mitad de
 * memoria, que con siete minutos de música es la diferencia que importa.
 */
const DECODE_RATE = 24_000

interface Voice {
  gain: GainNode
  source: AudioBufferSourceNode
  duration: number
}

let context: AudioContext | null = null
let master: GainNode | null = null
/** Momento del reloj de audio en el que el bucle estaba en su posición cero. */
let loopOrigin = 0
const voices = new Map<string, Voice>()
const loading = new Set<string>()
let wanted = new Set<string>()
let started = false

export function isMusicEnabled(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== 'off'
  } catch {
    return true
  }
}

function remember(enabled: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off')
  } catch {
    // Sin almacenamiento la preferencia dura lo que la sesión.
  }
}

function ensureContext(): AudioContext | null {
  if (context) return context
  const Ctor: typeof AudioContext | undefined = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  try {
    context = new Ctor({ sampleRate: DECODE_RATE })
  } catch {
    try {
      context = new Ctor()
    } catch {
      return null
    }
  }
  master = context.createGain()
  master.gain.value = isMusicEnabled() ? MASTER_VOLUME : 0
  // Red de seguridad: al subir capas los picos podrían sumar por encima de 1.
  // Solo actúa en esos picos y deja el resto intacto.
  const limiter = context.createDynamicsCompressor()
  limiter.threshold.value = -2
  limiter.knee.value = 0
  limiter.ratio.value = 20
  limiter.attack.value = 0.003
  limiter.release.value = 0.25
  master.connect(limiter)
  limiter.connect(context.destination)
  return context
}

function fade(gain: GainNode, to: number, seconds = FADE_SECONDS): void {
  if (!context) return
  const now = context.currentTime
  gain.gain.cancelScheduledValues(now)
  gain.gain.setValueAtTime(gain.gain.value, now)
  gain.gain.linearRampToValueAtTime(to, now + seconds)
}

async function addVoice(layer: MusicLayer): Promise<void> {
  const ctx = ensureContext()
  if (!ctx || voices.has(layer.id) || loading.has(layer.id)) return
  loading.add(layer.id)
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}audio/${layer.file}`)
    const buffer = await ctx.decodeAudioData(await response.arrayBuffer())
    // La capa puede haber dejado de hacer falta mientras se descargaba.
    if (!wanted.has(layer.id)) return
    const gain = ctx.createGain()
    gain.gain.value = 0
    gain.connect(master!)
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.loop = true
    source.connect(gain)
    // Entra en la misma posición del bucle que el resto: sigue calzada aunque
    // se incorpore siete minutos después de empezar.
    const elapsed = Math.max(0, ctx.currentTime - loopOrigin)
    source.start(ctx.currentTime, elapsed % buffer.duration)
    voices.set(layer.id, { gain, source, duration: buffer.duration })
    fade(gain, layer.gain)
  } catch {
    // Una capa que no carga simplemente no suena; el resto sigue.
  } finally {
    loading.delete(layer.id)
  }
}

/** Arranca la música. Debe llamarse desde un gesto del usuario. */
export function startMusic(active: Iterable<string>): void {
  const ctx = ensureContext()
  if (!ctx) return
  if (!started) {
    started = true
    loopOrigin = ctx.currentTime
  }
  void ctx.resume()
  syncMusicLayers(active)
}

export function isMusicStarted(): boolean {
  return started
}

/** Ajusta qué capas suenan. Las que sobran se apagan, no se detienen. */
export function syncMusicLayers(active: Iterable<string>): void {
  wanted = new Set(active)
  if (!started) return
  for (const layer of MUSIC_LAYERS) {
    const voice = voices.get(layer.id)
    if (wanted.has(layer.id)) {
      if (voice) fade(voice.gain, layer.gain)
      else void addVoice(layer)
    } else if (voice) {
      fade(voice.gain, 0)
    }
  }
}

export function setMusicEnabled(enabled: boolean): void {
  remember(enabled)
  if (!context || !master) return
  fade(master, enabled ? MASTER_VOLUME : 0, 0.6)
  if (enabled) void context.resume()
}

/** Estado del motor de audio, para depurar sin adivinar. */
export function musicStatus() {
  return {
    started,
    enabled: isMusicEnabled(),
    state: context?.state ?? 'sin contexto',
    sampleRate: context?.sampleRate ?? 0,
    master: master?.gain.value ?? 0,
    layers: MUSIC_LAYERS.map((layer) => ({
      id: layer.id,
      objetivo: layer.gain,
      gain: Number((voices.get(layer.id)?.gain.gain.value ?? 0).toFixed(3)),
      seconds: Number((voices.get(layer.id)?.duration ?? 0).toFixed(3)),
      loading: loading.has(layer.id),
    })),
  }
}

// Solo en desarrollo: permite inspeccionar el motor desde la consola.
if (import.meta.env.DEV && typeof window !== 'undefined') (window as unknown as { __music?: typeof musicStatus }).__music = musicStatus

/** Capas que corresponden al estado de tecnologías de la partida. */
export function layersForTechs(unlocked: Partial<Record<TechKey, boolean>>): Set<string> {
  return new Set(MUSIC_LAYERS.filter((layer) => !layer.tech || unlocked[layer.tech]).map((layer) => layer.id))
}
