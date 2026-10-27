import { Edges, Html, useGLTF } from '@react-three/drei'
import { Component, Suspense, useMemo, useState, type ReactNode } from 'react'
import * as THREE from 'three'
import type { MachineSummary } from '../api/types'
import { STATUS_META, shortId, statusHex } from '../lib/status'
import type { ThemeColors } from '../theme'
import { ASSETS_BASE, type ManifestEntity } from './manifest'
import { Conveyor, HydraulicPress, InspectionStation, MODEL_HEIGHT, Motor, Pump } from './ProceduralModels'

function Procedural({ entity }: { entity: ManifestEntity }) {
  switch (entity.type) {
    case 'HydraulicPress': return <HydraulicPress />
    case 'Pump': return <Pump />
    case 'Motor': return <Motor />
    case 'Conveyor': return <Conveyor length={entity.scale[0]} />
    case 'InspectionStation': return <InspectionStation />
    default: return null
  }
}

/** useGLTF caches by URL, so repeated machines share one loaded model. */
function Gltf({ url }: { url: string }) {
  const { scene } = useGLTF(url)
  const clone = useMemo(() => scene.clone(true), [scene])
  return <primitive object={clone} />
}

class GltfBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(e: unknown) { console.warn('[twin] GLB failed to load, using procedural geometry', e) }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

function ModelOrProcedural({ id, entity }: { id: string; entity: ManifestEntity }) {
  const procedural = <Procedural entity={entity} />
  if (!entity.modelPath) return procedural
  const warn = (
    <group>
      {procedural}
      <Html position={[0, 0.2, 1.2]} center>
        <span className="rounded bg-warn/15 px-1 text-[9px] text-warn" title={`Model for ${id} failed to load`}>model fallback</span>
      </Html>
    </group>
  )
  return (
    <GltfBoundary fallback={warn}>
      <Suspense fallback={procedural}>
        <Gltf url={`${ASSETS_BASE}/${entity.modelPath}`} />
      </Suspense>
    </GltfBoundary>
  )
}

const ringGeo = new THREE.RingGeometry(1.6, 1.85, 40)
const beaconGeo = new THREE.SphereGeometry(0.22, 16, 12)
const poleGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.6, 6)

interface Props {
  id: string
  entity: ManifestEntity
  machine: MachineSummary | undefined
  colors: ThemeColors
  selected: boolean
  onSelect: (id: string) => void
}

export function MachineObject({ id, entity, machine, colors, selected, onSelect }: Props) {
  const [hover, setHover] = useState(false)
  const status = machine?.status ?? 'Unknown'
  const meta = STATUS_META[status]
  const hex = statusHex(status, colors)
  const isConveyor = entity.type === 'Conveyor'
  const scale: [number, number, number] = isConveyor ? [1, 1, 1] : entity.scale
  const height = (MODEL_HEIGHT[entity.type] ?? 2) * scale[1]
  const r = Math.max(scale[0], scale[2]) * (selected ? 1.25 : 1)
  // Conveyors get an elongated ring that follows the belt.
  const ring: [number, number, number] = isConveyor ? [entity.scale[0] / 3.2 * (selected ? 1.1 : 1), selected ? 0.75 : 0.6, 1] : [r, r, 1]

  return (
    <group position={entity.position} rotation={entity.rotation}>
      <group
        scale={scale}
        onClick={(e) => { e.stopPropagation(); onSelect(id) }}
        onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = 'pointer' }}
        onPointerOut={() => { setHover(false); document.body.style.cursor = '' }}
      >
        <ModelOrProcedural id={id} entity={entity} />
      </group>

      {/* Status ring on the floor; bright and pulsing-size when selected (highlight). */}
      <mesh geometry={ringGeo} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}
        scale={ring}>
        <meshBasicMaterial color={selected ? colors.accent : hex} transparent opacity={selected || hover ? 0.95 : 0.6} side={THREE.DoubleSide} />
      </mesh>

      {/* Selection outline. */}
      {selected && (
        <mesh position={[0, height / 2, 0]} scale={isConveyor ? [entity.scale[0] + 0.4, height + 0.3, 1.4] : [2.9 * scale[0], height + 0.3, 2.5 * scale[2]]}>
          <boxGeometry />
          <meshBasicMaterial visible={false} />
          <Edges color={colors.accent} />
        </mesh>
      )}

      {/* Status beacon (stack light). */}
      <mesh geometry={poleGeo} position={[0, height + 0.3, 0]}>
        <meshStandardMaterial color={colors['line-strong']} />
      </mesh>
      <mesh geometry={beaconGeo} position={[0, height + 0.7, 0]}>
        <meshStandardMaterial color={hex} emissive={hex} emissiveIntensity={status === 'Offline' ? 0.1 : 1.4} />
      </mesh>

      {/* Label: icon + text, so colour is never the only indicator. Also a keyboard target. */}
      <Html position={[0, height + 1.4, 0]} center zIndexRange={[20, 0]}>
        <button
          type="button"
          data-twin-label
          onClick={() => onSelect(id)}
          aria-label={`${machine?.name ?? id}, status ${meta.label}`}
          className={`flex items-center gap-1 rounded-md bg-surface/95 px-1.5 py-0.5 font-mono text-[10px] font-medium whitespace-nowrap text-fg shadow-sm ring-1 ring-inset ring-line-strong ${
            selected ? 'outline-2 outline-accent' : ''
          } focus-visible:outline-2 focus-visible:outline-accent`}
        >
          <meta.Icon aria-hidden="true" className="size-3" style={{ color: hex }} strokeWidth={2.25} />
          {shortId(id)}
        </button>
      </Html>
    </group>
  )
}
