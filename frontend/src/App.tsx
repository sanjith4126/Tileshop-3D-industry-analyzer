import { useEffect, useState } from 'react'

type Health = 'checking' | 'ok' | 'unavailable'

export default function App() {
  const [health, setHealth] = useState<Health>('checking')

  useEffect(() => {
    fetch('/api/health')
      .then((r) => setHealth(r.ok ? 'ok' : 'unavailable'))
      .catch(() => setHealth('unavailable'))
  }, [])

  return (
    <div className="min-h-screen">
      <div role="status" className="bg-amber-500 px-4 py-1 text-center text-sm font-semibold text-slate-950">
        DEMONSTRATION FACILITY — SYNTHETIC DATA
      </div>
      <main className="p-6">
        <h1 className="text-2xl font-semibold">TileTwin Demonstration Facility</h1>
        <p className="mt-2 text-slate-400">
          Backend API: <span data-testid="api-health">{health}</span>
        </p>
      </main>
    </div>
  )
}
