import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Pone en el service worker un nombre de cache derivado del bundle.
 *
 * El nombre se subia a mano en cada version, y se quedo atras siete
 * despliegues seguidos: el `activate` del worker solo borra las caches cuyo
 * nombre NO coincide con el actual, asi que mientras el nombre no cambie la
 * cache vieja sobrevive y un jugador que vuelve se queda en la version
 * anterior. Acordarse no es un mecanismo; el hash del bundle si.
 */
function serviceWorkerCacheName(): Plugin {
  return {
    name: 'sw-cache-name',
    apply: 'build',
    writeBundle(options, bundle) {
      const entry = Object.keys(bundle).find((file) => file.endsWith('.js'))
      if (!entry) return
      const hash = entry.replace(/^.*index-|\.js$/g, '')
      const path = resolve(options.dir ?? 'dist', 'sw.js')
      const source = readFileSync(path, 'utf8')
      const updated = source.replace(/const CACHE_NAME = '[^']*'/, `const CACHE_NAME = 'nucleus-idle-${hash}'`)
      if (updated === source) throw new Error('no se encontro CACHE_NAME en sw.js')
      writeFileSync(path, updated)
    },
  }
}

export default defineConfig({
  plugins: [react(), serviceWorkerCacheName()],
  base: './',
  test: {
    // El taller de `src/art` no son pruebas: son generadores que reescriben los
    // sprites y las hojas de arte. Si entraran en `npm test`, cada corrida
    // modificaria el codigo fuente. Se lanzan a mano con `npm run art`.
    exclude: ['node_modules/**', 'dist/**', 'src/art/**'],
  },
})
