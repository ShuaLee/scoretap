import type { ReactNode } from 'react'

type SectionPanelProps = {
  title: string
  children: ReactNode
  className?: string
}

export function SectionPanel({ title, children, className = '' }: SectionPanelProps) {
  return (
    <section className={`section-panel ${className}`} aria-label={title}>
      <h2>{title}</h2>
      {children}
    </section>
  )
}
