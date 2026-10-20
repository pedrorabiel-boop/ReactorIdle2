import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  test: {
    // El taller de `src/art` no son pruebas: son generadores que reescriben los
    // sprites y las hojas de arte. Si entraran en `npm test`, cada corrida
    // modificaria el codigo fuente. Se lanzan a mano con `npm run art`.
    exclude: ['node_modules/**', 'dist/**', 'src/art/**'],
  },
})
