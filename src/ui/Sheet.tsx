import type { ReactNode } from 'react'

interface SheetProps {
  title: string
  eyebrow?: string
  onClose: () => void
  children: ReactNode
  className?: string
}

/** Panel inferior fijo que se abre sobre el mapa, encima de la barra de pestañas. */
export function Sheet({ title, eyebrow, onClose, children, className = '' }: SheetProps) {
  return (
    <section className={`sheet frame ${className}`} role="dialog" aria-modal="false" aria-label={title}>
      <div className="sheet-head">
        <div>
          {eyebrow && <span className="eyebrow">{eyebrow}</span>}
          <h2>{title}</h2>
        </div>
        <button className="icon-btn frame small" onClick={onClose} aria-label="Cerrar">×</button>
      </div>
      <div className="sheet-body">{children}</div>
    </section>
  )
}
