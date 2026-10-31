import { useQuery } from '@tanstack/react-query'
import { Activity, BookOpen, BrainCircuit, Database, Grid3x3, Server, Sparkles, Users, type LucideIcon } from 'lucide-react'
import { apiGet } from '../api/client'
import { POLL_MS } from '../api/hooks'
import { formatUtc } from '../lib/status'

export interface OverviewConfig {
  ai: boolean
  ml: { available: boolean; message: string; lastCheckedUtc: string | null }
  tileModel: { configured: boolean; status: string }
  knowledgeSearch: string
  devUsers: boolean
  simulatorPaused: boolean | null
  demoData: { seedBatchId: string; anchorUtc: string; seededUtc: string } | null
}

/** ratePercent is null when nothing was produced that day: no value, never 0 %. */
export interface ProductionDay { day: string; units: number; rejected: number; ratePercent: number | null }

export interface Overview {
  dataClassification: 'SYNTHETIC' | 'REAL'
  generatedAt: string
  statusCounts: Record<string, number>
  openAlerts: { total: number; critical: number }
  openHighPriorityObservations: number
  latestAnomaly: { machineId: string; score: number; threshold: number; timestampUtc: string; modelVersion: string } | null
  production?: { fromUtc: string; toUtc: string; units: number; rejected: number; ratePercent: number | null; days: ProductionDay[] }
  config: OverviewConfig
}

export const useOverview = () =>
  useQuery({ queryKey: ['overview'], queryFn: ({ signal }) => apiGet<Overview>('/api/overview', signal), refetchInterval: POLL_MS })

type Tone = 'ok' | 'warn' | 'neutral'
const TONE: Record<Tone, string> = {
  ok: 'bg-ok/10 text-ok ring-ok/30',
  warn: 'bg-warn/12 text-warn ring-warn/35',
  neutral: 'bg-raised text-muted ring-line-strong',
}

function Row({ Icon, label, tone, text }: { Icon: LucideIcon; label: string; tone: Tone; text: string }) {
  return (
    <li className="flex items-center gap-3 px-4 py-2.5">
      <Icon className="size-4 shrink-0 text-subtle" strokeWidth={1.75} aria-hidden="true" />
      <span className="min-w-0 flex-1 text-[13px] text-muted">{label}</span>
      <span className={`max-w-[60%] truncate rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${TONE[tone]}`} title={text}>{text}</span>
    </li>
  )
}

/** Configuration status of every optional component (shared by Overview and Administration). */
export function ConfigStatus({ config: c }: { config: OverviewConfig }) {
  const mlChecked = !!c.ml.lastCheckedUtc
  return (
    <ul className="divide-y divide-line/70">
      <Row Icon={Server} label="Backend API / database" tone="ok" text="Online" />
      <Row Icon={Sparkles} label="AI assistant" tone={c.ai ? 'ok' : 'warn'} text={c.ai ? 'Configured' : 'AI NOT CONFIGURED'} />
      <Row Icon={BrainCircuit} label="ML anomaly service" tone={!mlChecked ? 'neutral' : c.ml.available ? 'ok' : 'warn'}
        text={!mlChecked ? 'Not checked yet' : c.ml.available ? 'Reachable' : 'ML service unavailable'} />
      <Row Icon={Grid3x3} label="Tile defect model" tone={c.tileModel.configured ? 'ok' : 'warn'}
        text={c.tileModel.configured ? 'Configured' : c.tileModel.status.startsWith('ML service') ? 'ML service unavailable' : 'MODEL NOT CONFIGURED'} />
      <Row Icon={BookOpen} label="Knowledge search" tone={c.knowledgeSearch.startsWith('keyword') ? 'neutral' : 'ok'} text={c.knowledgeSearch} />
      <Row Icon={Activity} label="Live simulator" tone={c.simulatorPaused == null ? 'neutral' : c.simulatorPaused ? 'warn' : 'ok'}
        text={c.simulatorPaused == null ? 'No demo data' : c.simulatorPaused ? 'Paused' : 'Running'} />
      <Row Icon={Users} label="Dev users" tone="neutral" text={c.devUsers ? 'DEV ONLY users enabled' : 'None'} />
      <Row Icon={Database} label="Demo data" tone="neutral" text={c.demoData ? `${c.demoData.seedBatchId} · ${formatUtc(c.demoData.seededUtc)}` : 'Not seeded'} />
    </ul>
  )
}
