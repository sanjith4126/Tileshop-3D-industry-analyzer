import { useMutation, useQuery } from '@tanstack/react-query'
import { Box, KeyRound, LogIn, RotateCcw, SendHorizontal, Sparkles, Wrench } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { apiGet, apiSend } from '../../api/client'
import { useAuth } from '../../auth/auth'
import { DemoBadge, ErrorState, Loading } from '../../components/States'
import { focusEntity } from '../../store/focus'

interface Turn { role: 'user' | 'assistant'; text: string; toolCalls?: { name: string; inputJson: string; isError: boolean }[]; focusEntityIds?: string[]; disclaimer?: string }
interface ChatResponse { answer: string; toolCalls: { name: string; inputJson: string; isError: boolean }[]; focusEntityIds: string[]; toolLimitReached: boolean; disclaimer: string }

const EXAMPLES = ['Which machines have active alerts?', 'Summarise the last 24 hours for MACHINE-HP-002.', 'What are the open high-priority observations in Glazing & Inspection?']

function Avatar() {
  return <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent/12 text-accent ring-1 ring-accent/30 ring-inset" aria-hidden="true"><Sparkles className="size-4" /></span>
}

export default function AssistantPage() {
  const status = useQuery({ queryKey: ['assistant-status'], queryFn: ({ signal }) => apiGet<{ configured: boolean; model: string | null; message: string | null }>('/api/assistant/status', signal) })
  const { session } = useAuth()
  const navigate = useNavigate()
  const [turns, setTurns] = useState<Turn[]>([])
  const [input, setInput] = useState('')
  const scroller = useRef<HTMLDivElement>(null)

  const send = useMutation({
    mutationFn: (history: Turn[]) => apiSend<ChatResponse>('POST', '/api/assistant/chat',
      { messages: history.slice(-20).map(({ role, text }) => ({ role, text })) }, session?.token ?? null),
    onSuccess: (r) => setTurns((t) => [...t, { role: 'assistant', text: r.answer, toolCalls: r.toolCalls, focusEntityIds: r.focusEntityIds, disclaimer: r.disclaimer }]),
  })

  useEffect(() => { scroller.current?.scrollTo?.({ top: scroller.current.scrollHeight, behavior: 'smooth' }) }, [turns.length, send.isPending])

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
    <div className="mx-auto flex h-full max-w-4xl flex-col px-6 py-6">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Intelligence</p>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="display text-[26px] leading-tight font-semibold text-fg">AI Assistant</h1>
            <DemoBadge />
            {status.data.model && <span className="chip font-mono">{status.data.model}</span>}
          </div>
          <p className="mt-1.5 text-sm text-muted">Answers come only from plant records via read-only, audited tools. It cites record IDs and never confirms a fault.</p>
        </div>
        {turns.length > 0 && <button onClick={() => { setTurns([]); send.reset() }} className="btn btn-ghost btn-sm"><RotateCcw className="size-3.5" aria-hidden="true" />New conversation</button>}
      </header>

      {!status.data.configured ? (
        <div role="alert" className="card flex gap-4 border-warn/40 p-6">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-warn/12 text-warn"><KeyRound className="size-5" aria-hidden="true" /></span>
          <div>
            <p className="display text-lg font-bold text-warn">AI NOT CONFIGURED</p>
            <p className="mt-2 text-sm text-fg">Set <code className="text-warn">GROQ_API_KEY</code> (with <code className="text-warn">LLM__Provider=groq</code>), or <code className="text-warn">ANTHROPIC_API_KEY</code> and <code className="text-warn">LLM__Model</code>, in <code>.env</code>, then restart the backend.</p>
            <p className="mt-2 text-xs text-subtle">No canned answers are shown. All other modules work without AI.</p>
          </div>
        </div>
      ) : !session ? (
        <div className="card flex items-center gap-3 p-6 text-sm text-muted"><LogIn className="size-5 text-subtle" aria-hidden="true" />Sign in (any role) to use the assistant.</div>
      ) : (
        <div className="card flex min-h-0 flex-1 flex-col overflow-hidden">
          <div ref={scroller} className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5" aria-live="polite">
            {turns.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center gap-4 py-8 text-center">
                <span className="flex size-12 items-center justify-center rounded-2xl bg-accent/12 text-accent ring-1 ring-accent/30 ring-inset"><Sparkles className="size-6" aria-hidden="true" /></span>
                <div>
                  <p className="display text-lg font-semibold text-fg">Ask about the plant</p>
                  <p className="mt-1 max-w-md text-sm text-muted">Machines, alerts, readings, inspections, maintenance or production — every answer is grounded in tool results.</p>
                </div>
                <div className="grid w-full max-w-2xl gap-2 sm:grid-cols-3">
                  {EXAMPLES.map((e) => (
                    <button key={e} onClick={() => ask(e)} className="rounded-xl border border-line bg-raised/60 p-3 text-left text-sm text-fg transition-colors hover:border-accent/50 hover:bg-raised">{e}</button>
                  ))}
                </div>
              </div>
            )}
            {turns.map((t, i) => t.role === 'user' ? (
              <div key={i} className="flex justify-end">
                <p className="max-w-[80%] rounded-2xl rounded-br-md bg-accent-strong px-4 py-2.5 text-sm whitespace-pre-wrap text-on-accent">{t.text}</p>
              </div>
            ) : (
              <div key={i} className="flex gap-3">
                <Avatar />
                <div className="min-w-0 max-w-[85%] space-y-2 text-sm">
                  <p className="leading-relaxed whitespace-pre-wrap text-fg">{t.text}</p>
                  {t.toolCalls && t.toolCalls.length > 0 && (
                    <details className="rounded-lg border border-line bg-sunken/70 px-3 py-2 text-xs text-subtle">
                      <summary className="flex cursor-pointer items-center gap-1.5 hover:text-fg"><Wrench className="size-3.5" aria-hidden="true" />{t.toolCalls.length} tool call(s) · {[...new Set(t.toolCalls.map((c) => c.name))].join(', ')}</summary>
                      <ul className="mt-2 space-y-1 font-mono">{t.toolCalls.map((c, j) => <li key={j} className={`break-all ${c.isError ? 'text-crit' : ''}`}>{c.name} {c.inputJson}</li>)}</ul>
                    </details>
                  )}
                  {t.focusEntityIds && t.focusEntityIds.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {t.focusEntityIds.map((id) => <button key={id} onClick={() => { focusEntity(id); navigate('/twin') }} className="btn btn-secondary btn-sm"><Box className="size-3.5" aria-hidden="true" />Show {id} in 3D</button>)}
                    </div>
                  )}
                  {t.disclaimer && <p className="text-[11px] text-subtle">{t.disclaimer}</p>}
                </div>
              </div>
            ))}
            {send.isPending && <div className="flex gap-3"><Avatar /><Loading label="Querying plant records…" /></div>}
            {send.isError && <ErrorState error={send.error} />}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); ask(input) }} className="flex items-center gap-2 border-t border-line bg-raised/40 p-3">
            <label htmlFor="ask" className="sr-only">Question</label>
            <input id="ask" value={input} maxLength={4000} onChange={(e) => setInput(e.target.value)} placeholder="Ask about the plant…" className="input h-10 flex-1" />
            <button type="submit" disabled={send.isPending || !input.trim()} className="btn btn-primary btn-lg"><SendHorizontal className="size-4" aria-hidden="true" />Send</button>
          </form>
        </div>
      )}
    </div>
  )
}
