import { Compass } from 'lucide-react'
import { Link } from 'react-router'

/** Not-found page: honest, with a way back (no dead ends). */
export default function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="card bg-blueprint max-w-md p-8 text-center">
        <Compass className="mx-auto size-8 text-subtle" aria-hidden="true" />
        <p className="num mt-3 text-5xl font-semibold text-fg">404</p>
        <h1 className="display mt-2 text-xl font-semibold text-fg">{title}</h1>
        <p className="mt-2 text-sm text-muted">There is no page at this address.</p>
        <Link to="/" className="btn btn-primary mt-5">Back to Overview</Link>
      </div>
    </div>
  )
}
