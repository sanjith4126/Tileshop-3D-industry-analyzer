import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { apiGet, apiSend } from '../../api/client'
import { useAuth } from '../../auth/auth'
import { DemoBadge, ErrorState, Loading } from '../../components/States'
import { focusEntity } from '../../store/focus'

interface Turn { role: 'user' | 'assistant'; text: string; toolCalls?: { name: string; inputJson: string; isError: boolean }[]; focusEntityIds?: string[]; disclaimer?: string }
interface ChatResponse { answer: string; toolCalls: { name: string; inputJson: string; isError: boolean }[]; focusEntityIds: string[]; toolLimitReached: boolean; disclaimer: string }

const EXAMPLES = ['Which machines have active alerts?', 'Summarise the last 24 hours for MACHINE-HP-002.', 'What are the open high-priority observations in Glazing & Inspection?']

export default function AssistantPage() {
  const status = useQuery({ queryKey: ['assistant-status'], queryFn: ({ signal }) => apiGet<{ configured: boolean; model: string | null; message: string | null }>('/api/assistant/status', signal) })
  const { session } = useAuth()
  const navigate = useNavigate()
  const [turns, setTurns] = useState<Turn[]>([])
  const [input, setInput] = useState('')

  const send = useMutation({
    mutationFn: (history: Turn[]) => apiSend<ChatResponse>('POST', '/api/assistant/chat',
      { messages: history.slice(-20).map(({ role, text }) => ({ role, text })) }, session?.token ?? null),
    onSuccess: (r) => setTurns((t) => [...t, { role: 'assistant', text: r.answer, toolCalls: r.toolCalls, focusEntityIds: r.focusEntityIds, disclaimer: r.disclaimer }]),
  })

  const ask = (text: string) => {
    const q = text.trim()
    if (!q || send.isPending) return
    const history = [...turns, { role: 'user' as const, text: q }]
    setTurns(history)
    setInput('')
    send.mutate(history)
  }

  if (status.isPending) return <Loading />
  if (status.isError) return <ErrorState error={status.error} onRetry={() => status.refetch()} />

  return (
    <div className="flex h-full flex-col p-5">
      <header className="mb-3 flex items-center gap-3">
        <h1 className="text-xl font-semibold">AI Assistant</h1>
        <DemoBadge />
        {status.data.model && <span className="text-xs text-slate-500">model {status.data.model}</span>}
      </header>

      {!status.data.configured ? (
        <div role="alert" className="max-w-2xl rounded-lg border border-amber-500/50 bg-amber-950/30 p-5">
          <p className="text-lg font-bold text-amber-300">AI NOT CONFIGURED</p>
          <p className="mt-2 text-sm text-slate-300">Set <code className="text-amber-200">GROQ_API_KEY</code> (with <code className="text-amber-200">LLM__Provider=groq</code>), or <code className="text-amber-200">ANTHROPIC_API_KEY</code> and <code className="text-amber-200">LLM__Model</code>, in <code>.env</code>, then restart the backend.</p>
          <p className="mt-2 text-xs text-slate-500">No canned answers are shown. All other modules work without AI.</p>
        </div>
      ) : !session ? (
        <p className="text-sm text-slate-400">Sign in (any role) to use the assistant.</p>
      ) : (
        <>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-lg border border-slate-800 bg-slate-900/50 p-4" aria-live="polite">
            {turns.length === 0 && (
              <div className="space-y-2 text-sm text-slate-400">
                <p>Ask about machines, alerts, readings, inspections, maintenance or production. Answers come only from the plant records via read-only tools.</p>
                <div className="flex flex-wrap gap-2">
                  {EXAMPLES.map((e) => <button key={e} onClick={() => ask(e)} className="rounded bg-slate-800 px-2 py-1 text-xs hover:bg-slate-700">{e}</button>)}
                </div>
              </div>
            )}
            {turns.map((t, i) => (
              <div key={i} className={t.role === 'user' ? 'ml-auto max-w-2xl rounded-lg bg-cyan-900/40 px-3 py-2 text-sm' : 'max-w-3xl space-y-2 text-sm'}>
                <p className="whitespace-pre-wrap">{t.text}</p>
                {t.toolCalls && t.toolCalls.length > 0 && (
                  <details className="text-xs text-slate-500">
                    <summary className="cursor-pointer">{t.toolCalls.length} tool call(s)</summary>
                    <ul className="mt-1 space-y-0.5 font-mono">{t.toolCalls.map((c, j) => <li key={j} className={c.isError ? 'text-red-300' : ''}>{c.name} {c.inputJson}</li>)}</ul>
                  </details>
                )}
                {t.focusEntityIds && t.focusEntityIds.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {t.focusEntityIds.map((id) => <button key={id} onClick={() => { focusEntity(id); navigate('/twin') }} className="rounded bg-slate-800 px-2 py-0.5 text-xs hover:bg-slate-700">Show {id} in 3D</button>)}
                  </div>
                )}
                {t.disclaimer && <p className="text-[11px] text-slate-500">{t.disclaimer}</p>}
              </div>
            ))}
            {send.isPending && <Loading label="Thinking (querying plant records)…" />}
            {send.isError && <ErrorState error={send.error} />}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); ask(input) }} className="mt-3 flex gap-2">
            <label htmlFor="ask" className="sr-only">Question</label>
            <input id="ask" value={input} maxLength={4000} onChange={(e) => setInput(e.target.value)} placeholder="Ask about the plant…"
              className="flex-1 rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none" />
            <button type="submit" disabled={send.isPending || !input.trim()} className="rounded bg-cyan-700 px-4 py-2 text-sm font-semibold hover:bg-cyan-600 disabled:opacity-50">Send</button>
          </form>
        </>
      )}
    </div>
  )
}
