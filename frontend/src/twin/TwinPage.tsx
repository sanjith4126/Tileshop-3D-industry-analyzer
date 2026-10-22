import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useMachines, useZones } from '../api/hooks'
import { DemoBadge, ErrorState, Loading } from '../components/States'
import { focusEntity, useFocus } from '../store/focus'
import { FactoryScene, type CameraApi, type FocusTarget } from './FactoryScene'
import { MachinePanel } from './MachinePanel'
import { useManifest } from './manifest'
import { StatusLegend, TwinToolbar } from './TwinToolbar'

export default function TwinPage() {
  const manifest = useManifest()
  const machinesQ = useMachines()
  const zonesQ = useZones()
  const focus = useFocus()
  const [params, setParams] = useSearchParams()
  const camera = useRef<CameraApi>(null)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [zoneId, setZoneId] = useState<string | null>(null)
  const [hiddenZones, setHiddenZones] = useState<Set<string>>(new Set())
  const [focusTarget, setFocusTarget] = useState<FocusTarget | null>(null)

  const machines = useMemo(() => new Map((machinesQ.data ?? []).map((m) => [m.id, m])), [machinesQ.data])

  // ?focus=ID in the URL feeds the shared store (deep links from other pages).
  useEffect(() => {
    const id = params.get('focus')
    if (id) {
      focusEntity(id)
      setParams({}, { replace: true })
    }
  }, [params, setParams])

  // Apply focus requests from any module once the manifest is available.
  useEffect(() => {
    const id = focus.entityId
    const entity = id ? manifest.data?.entities[id] : undefined
    if (!id || !entity) return
    if (entity.type === 'Zone') {
      setZoneId(id)
      setSelectedId(null)
      setHiddenZones((h) => { const n = new Set(h); n.delete(id); return n })
    } else {
      setSelectedId(id)
      setZoneId(null)
    }
    setFocusTarget({ entity, seq: focus.seq })
  }, [focus.seq, focus.entityId, manifest.data])

  const select = (id: string | null) => {
    if (id) focusEntity(id)
    else setSelectedId(null)
  }

  if (manifest.isPending || machinesQ.isPending || zonesQ.isPending) return <Loading label="Loading 3D twin…" />
  const error = manifest.error ?? machinesQ.error ?? zonesQ.error
  if (error || !manifest.data) return <ErrorState error={error} onRetry={() => { manifest.refetch(); machinesQ.refetch(); zonesQ.refetch() }} />

  return (
    <div className="flex h-full">
      <div className="relative min-w-0 flex-1">
        <FactoryScene
          ref={camera}
          focusTarget={focusTarget}
          manifest={manifest.data}
          machines={machines}
          zones={zonesQ.data ?? []}
          selectedId={selectedId}
          highlightZoneId={zoneId}
          hiddenZones={hiddenZones}
          onSelect={select}
        />
        <div className="pointer-events-none absolute top-3 left-3 z-30 flex flex-col gap-2">
          <div className="pointer-events-auto flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/90 px-2 py-1">
            <h1 className="text-sm font-semibold">3D Digital Twin</h1>
            <DemoBadge />
          </div>
          <TwinToolbar
            machines={machinesQ.data ?? []}
            zones={zonesQ.data ?? []}
            hiddenZones={hiddenZones}
            onToggleZone={(id) => setHiddenZones((h) => { const n = new Set(h); if (n.has(id)) n.delete(id); else n.add(id); return n })}
            onSearch={(id) => focusEntity(id)}
            onReset={() => { setZoneId(null); camera.current?.reset() }}
            onFit={() => camera.current?.fitFactory()}
          />
        </div>
        <div className="pointer-events-none absolute bottom-3 left-3 z-30"><StatusLegend /></div>
        <p className="pointer-events-none absolute right-3 bottom-3 text-[10px] text-slate-500">
          Drag: orbit · Right-drag: pan · Wheel: zoom · Tab to machine labels
        </p>
      </div>
      {selectedId && <MachinePanel id={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  )
}
