import { useQuery } from '@tanstack/react-query'
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

export interface Overview {
  statusCounts: Record<string, number>
  openAlerts: { total: number; critical: number }
  openHighPriorityObservations: number
  latestAnomaly: { machineId: string; score: number; threshold: number; timestampUtc: string; modelVersion: string } | null
  config: OverviewConfig
}

export const useOverview = () =>
  useQuery({ queryKey: ['overview'], queryFn: ({ signal }) => apiGet<Overview>('/api/overview', signal), refetchInterval: POLL_MS })

function Row({ label, ok, text }: { label: string; ok: boolean | null; text: string }) {
  const tone = ok == null ? 'text-slate-400' : ok ? 'text-green-300' : 'text-amber-300'
  return (
    <li className="flex justify-between gap-4 border-t border-slate-800/70 px-3 py-1.5 text-xs first:border-0">
      <span className="text-slate-400">{label}</span>
      <span className={`text-right font-semibold ${tone}`}>{text}</span>
    </li>
  )
}

/** Configuration status of every optional component (shared by Overview and Administration). */
export function ConfigStatus({ config: c }: { config: OverviewConfig }) {
  return (
    <ul>
      <Row label="Backend API / database" ok text="Online" />
      <Row label="AI assistant" ok={c.ai} text={c.ai ? 'Configured' : 'AI NOT CONFIGURED'} />
      <Row label="ML anomaly service" ok={c.ml.lastCheckedUtc ? c.ml.available : null} text={c.ml.lastCheckedUtc ? (c.ml.available ? 'Reachable' : 'ML service unavailable') : 'Not checked yet'} />
      <Row label="Tile defect model" ok={c.tileModel.configured} text={c.tileModel.configured ? 'Configured' : c.tileModel.status.startsWith('ML service') ? 'ML service unavailable' : 'MODEL NOT CONFIGURED'} />
      <Row label="Knowledge search" ok={!c.knowledgeSearch.startsWith('keyword')} text={c.knowledgeSearch} />
      <Row label="Live simulator" ok={c.simulatorPaused == null ? null : !c.simulatorPaused} text={c.simulatorPaused == null ? 'No demo data' : c.simulatorPaused ? 'Paused' : 'Running'} />
      <Row label="Dev users" ok={null} text={c.devUsers ? 'DEV ONLY users enabled' : 'None'} />
      <Row label="Demo data" ok={null} text={c.demoData ? `${c.demoData.seedBatchId}, seeded ${formatUtc(c.demoData.seededUtc)}` : 'Not seeded'} />
    </ul>
  )
}
