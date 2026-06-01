import type { ReactNode } from 'react'

type MainAreaProps = {
  children?: ReactNode
}

export function MainArea({ children }: MainAreaProps) {
  return <main className="main-area">{children}</main>
}
