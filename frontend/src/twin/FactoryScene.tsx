import { CameraControls, Edges, Grid, Html } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import * as THREE from 'three'
import type { MachineSummary, Zone } from '../api/types'
import type { ThemeColors } from '../theme'
import type { AssetManifest, ManifestEntity, Vec3 } from './manifest'
import { MachineObject } from './MachineObject'
import { Kiln, RackRow } from './ProceduralModels'

export interface CameraApi {
  reset: () => void
  fitFactory: () => void
}

const HOME = { pos: [38, 34, 46] as Vec3, target: [0, 0, 0] as Vec3 }
const MACHINE_TYPES = new Set(['HydraulicPress', 'Pump', 'Motor', 'Conveyor', 'InspectionStation'])

export interface FocusTarget {
  entity: ManifestEntity
  seq: number
}

/** Runs inside the Canvas so the camera controls are guaranteed to be mounted. */
function FocusDriver({ target, apply }: { target: FocusTarget | null; apply: (e: ManifestEntity) => void }) {
  const seq = target?.seq
  useEffect(() => {
    if (target) apply(target.entity)
  }, [seq]) // only when a new focus request arrives
  return null
}

interface Props {
  colors: ThemeColors
  focusTarget: FocusTarget | null
  manifest: AssetManifest
  machines: Map<string, MachineSummary>
  zones: Zone[]
  selectedId: string | null
  highlightZoneId: string | null
  hiddenZones: Set<string>
  onSelect: (id: string | null) => void
}

export const FactoryScene = forwardRef<CameraApi, Props>(function FactoryScene(props, ref) {
  const { colors: c, focusTarget, manifest, machines, zones, selectedId, highlightZoneId, hiddenZones, onSelect } = props
  const controls = useRef<CameraControls>(null)
  const [bw, bh, bd] = manifest.building.size

  const focusOn = (e: ManifestEntity) => {
    const [x, , z] = e.position
    if (e.type === 'Zone') {
      const span = Math.max(e.scale[0], e.scale[2])
      void controls.current?.setLookAt(x + span * 0.5, span * 0.9, z + span * 0.9, x, 0, z, true)
    } else {
      void controls.current?.setLookAt(x + 7, 8, z + 11, x, 1.5, z, true)
    }
  }

  useImperativeHandle(ref, () => ({
    reset: () => void controls.current?.setLookAt(...HOME.pos, ...HOME.target, true),
    fitFactory: () => void controls.current?.fitToBox(
      new THREE.Box3(new THREE.Vector3(-bw / 2, 0, -bd / 2), new THREE.Vector3(bw / 2, 4, bd / 2)), true,
      { paddingTop: 2, paddingBottom: 2, paddingLeft: 2, paddingRight: 2 }),
  }), [bw, bd])

  const entities = Object.entries(manifest.entities)

  return (
    <Canvas dpr={[1, 1.5]} camera={{ position: HOME.pos, fov: 45, near: 0.5, far: 500 }} onPointerMissed={(ev) => {
        // HTML labels sit inside the canvas container; a click on one is not a "miss".
        if ((ev.target as HTMLElement | null)?.closest?.('[data-twin-label]')) return
        onSelect(null)
      }}>
      <color attach="background" args={[c['scene-bg']]} />
      <fog attach="fog" args={[c['scene-bg'], 90, 190]} />
      <hemisphereLight args={['#f1efe9', c['scene-floor'], 1.0]} />
      <directionalLight position={[30, 50, 20]} intensity={1.5} />
      <directionalLight position={[-40, 20, -10]} intensity={0.35} color="#9fb4ff" />
      <CameraControls ref={controls} makeDefault minDistance={4} maxDistance={140} maxPolarAngle={Math.PI / 2.1} smoothTime={0.6} />
      <FocusDriver target={focusTarget} apply={focusOn} />

      {/* Building shell (cut-away: floor, two walls, columns). */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[bw + 4, bd + 4]} />
        <meshStandardMaterial color={c['scene-floor']} roughness={1} />
      </mesh>
      <Grid args={[bw, bd]} cellSize={2} sectionSize={10} cellColor={c['scene-grid']} sectionColor={c['scene-grid-major']} fadeDistance={160} position={[0, 0.005, 0]} />
      <mesh position={[0, bh / 2, -bd / 2 - 0.1]}>
        <boxGeometry args={[bw, bh, 0.2]} />
        <meshStandardMaterial color={c['scene-wall']} transparent opacity={0.4} />
      </mesh>
      <mesh position={[-bw / 2 - 0.1, bh / 2, 0]}>
        <boxGeometry args={[0.2, bh, bd]} />
        <meshStandardMaterial color={c['scene-wall']} transparent opacity={0.4} />
      </mesh>
      {Array.from({ length: 9 }, (_, i) => -bw / 2 + (i * bw) / 8).map((x) => (
        <mesh key={x} position={[x, bh / 2, -bd / 2 + 0.3]}>
          <boxGeometry args={[0.4, bh, 0.4]} />
          <meshStandardMaterial color={c['scene-wall']} />
        </mesh>
      ))}

      {entities.map(([id, e]) => {
        if (e.type === 'Zone') {
          if (hiddenZones.has(id)) return null
          const zone = zones.find((z) => z.id === id)
          const lit = highlightZoneId === id
          return (
            <group key={id} position={e.position}>
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
                <planeGeometry args={[e.scale[0] - 0.4, e.scale[2]]} />
                <meshBasicMaterial color={c.accent} transparent opacity={lit ? 0.2 : 0.05} />
              </mesh>
              <mesh position={[0, 0.05, 0]} scale={[e.scale[0] - 0.4, 0.1, e.scale[2]]}>
                <boxGeometry />
                <meshBasicMaterial visible={false} />
                <Edges color={lit ? c.accent : c['scene-grid-major']} />
              </mesh>
              <Html position={[0, 0.1, e.scale[2] / 2 + 0.8]} center zIndexRange={[10, 0]}>
                <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold tracking-[0.14em] whitespace-nowrap uppercase shadow-sm ${lit ? 'bg-accent-strong text-on-accent' : 'bg-surface/90 text-muted ring-1 ring-line'}`}>
                  {zone?.name ?? id}
                </span>
              </Html>
            </group>
          )
        }
        if (e.type === 'Kiln') return <group key={id} position={e.position}><Kiln scale={e.scale} /></group>
        if (e.type === 'RackRow') return <group key={id} position={e.position} rotation={e.rotation}><RackRow /></group>
        if (!MACHINE_TYPES.has(e.type)) return null

        const machine = machines.get(id)
        if (machine && hiddenZones.has(machine.zoneId)) return null
        return <MachineObject key={id} id={id} entity={e} machine={machine} colors={c} selected={selectedId === id} onSelect={onSelect} />
      })}
    </Canvas>
  )
})
