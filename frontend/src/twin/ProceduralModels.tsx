import { Instance, Instances } from '@react-three/drei'
import { useMemo } from 'react'
import * as THREE from 'three'

/**
 * Low-poly procedural stand-ins. Dimensions are illustrative only — not real equipment.
 * Geometries and materials are module-level so every repeated machine shares them.
 */
const box = new THREE.BoxGeometry(1, 1, 1)
const cyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 16)

export const MAT = {
  steel: new THREE.MeshStandardMaterial({ color: '#8a96a8', metalness: 0.6, roughness: 0.45 }),
  dark: new THREE.MeshStandardMaterial({ color: '#2b3442', metalness: 0.4, roughness: 0.7 }),
  paint: new THREE.MeshStandardMaterial({ color: '#3b5b7a', metalness: 0.3, roughness: 0.6 }),
  belt: new THREE.MeshStandardMaterial({ color: '#1c1f24', roughness: 0.9 }),
  kiln: new THREE.MeshStandardMaterial({ color: '#7a4a32', roughness: 0.8 }),
  rack: new THREE.MeshStandardMaterial({ color: '#c2721b', metalness: 0.3, roughness: 0.6 }),
  pallet: new THREE.MeshStandardMaterial({ color: '#a8a29e', roughness: 0.9 }),
}

type P = { position?: [number, number, number]; scale?: [number, number, number]; rotation?: [number, number, number] }
const Box = ({ m, ...p }: P & { m: THREE.Material }) => <mesh geometry={box} material={m} {...p} />
const Cyl = ({ m, ...p }: P & { m: THREE.Material }) => <mesh geometry={cyl} material={m} {...p} />

/** Height of each model's top, used to place the status beacon and label. */
export const MODEL_HEIGHT: Record<string, number> = {
  HydraulicPress: 4.4, Pump: 1.3, Motor: 1.4, Conveyor: 1.1, InspectionStation: 2.6,
}

export function HydraulicPress() {
  return (
    <group>
      <Box m={MAT.dark} position={[0, 0.3, 0]} scale={[2.6, 0.6, 2.2]} />
      {[-0.95, 0.95].map((x) => [-0.75, 0.75].map((z) => (
        <Cyl key={`${x}${z}`} m={MAT.steel} position={[x, 2.2, z]} scale={[0.22, 3.4, 0.22]} />
      )))}
      <Box m={MAT.paint} position={[0, 4.1, 0]} scale={[2.4, 0.6, 2]} />
      <Cyl m={MAT.steel} position={[0, 3.2, 0]} scale={[0.9, 1.2, 0.9]} />
      <Box m={MAT.paint} position={[0, 2.4, 0]} scale={[1.8, 0.35, 1.5]} />
      <Box m={MAT.dark} position={[0, 0.75, 0]} scale={[1.6, 0.3, 1.4]} />
    </group>
  )
}

export function Pump() {
  return (
    <group>
      <Box m={MAT.dark} position={[0, 0.1, 0]} scale={[2.2, 0.2, 0.9]} />
      <Cyl m={MAT.paint} position={[-0.45, 0.65, 0]} rotation={[0, 0, Math.PI / 2]} scale={[0.8, 1, 0.8]} />
      <Cyl m={MAT.steel} position={[0.6, 0.6, 0]} rotation={[0, 0, Math.PI / 2]} scale={[0.9, 0.5, 0.9]} />
      <Cyl m={MAT.steel} position={[0.6, 1.15, 0]} scale={[0.25, 0.4, 0.25]} />
    </group>
  )
}

export function Motor() {
  return (
    <group>
      <Box m={MAT.dark} position={[0, 0.15, 0]} scale={[1.6, 0.3, 1]} />
      <Cyl m={MAT.paint} position={[0, 0.75, 0]} rotation={[0, 0, Math.PI / 2]} scale={[1, 1.3, 1]} />
      <Cyl m={MAT.steel} position={[0.85, 0.75, 0]} rotation={[0, 0, Math.PI / 2]} scale={[0.2, 0.5, 0.2]} />
      <Box m={MAT.dark} position={[0, 1.3, 0]} scale={[0.4, 0.2, 0.4]} />
    </group>
  )
}

export function Conveyor({ length }: { length: number }) {
  const legs = useMemo(() => {
    const n = Math.max(2, Math.round(length / 2) + 1)
    return Array.from({ length: n }, (_, i) => -length / 2 + 0.3 + (i * (length - 0.6)) / (n - 1))
  }, [length])
  return (
    <group>
      <Box m={MAT.belt} position={[0, 0.95, 0]} scale={[length, 0.12, 0.9]} />
      <Box m={MAT.steel} position={[0, 0.85, 0.5]} scale={[length, 0.25, 0.08]} />
      <Box m={MAT.steel} position={[0, 0.85, -0.5]} scale={[length, 0.25, 0.08]} />
      {legs.map((x) => (
        <Box key={x} m={MAT.dark} position={[x, 0.4, 0]} scale={[0.1, 0.8, 0.9]} />
      ))}
    </group>
  )
}

export function InspectionStation() {
  return (
    <group>
      <Box m={MAT.belt} position={[0, 0.9, 0]} scale={[2.6, 0.12, 0.9]} />
      <Box m={MAT.steel} position={[0, 0.45, 0]} scale={[2.4, 0.9, 0.7]} />
      <Box m={MAT.paint} position={[-0.9, 1.6, 0]} scale={[0.15, 1.4, 1.4]} />
      <Box m={MAT.paint} position={[0.9, 1.6, 0]} scale={[0.15, 1.4, 1.4]} />
      <Box m={MAT.paint} position={[0, 2.35, 0]} scale={[1.95, 0.3, 1.4]} />
      <Box m={MAT.dark} position={[0, 2.05, 0]} scale={[0.5, 0.3, 0.5]} />
    </group>
  )
}

export function Kiln({ scale }: { scale: [number, number, number] }) {
  const [l, h, d] = scale
  return (
    <group>
      <Box m={MAT.kiln} position={[0, h / 2, 0]} scale={[l, h, d]} />
      <Box m={MAT.dark} position={[0, h + 0.15, 0]} scale={[l * 0.98, 0.3, d * 0.6]} />
      {[-l / 3, 0, l / 3].map((x) => (
        <Cyl key={x} m={MAT.steel} position={[x, h + 1.2, 0]} scale={[0.5, 2, 0.5]} />
      ))}
    </group>
  )
}

/** Storage racking, instanced (many repeated boxes → one draw call per part). */
export function RackRow() {
  const bays = 5
  const uprights = useMemo(() => Array.from({ length: (bays + 1) * 2 }, (_, i) => [-5 + Math.floor(i / 2) * 2, 2, i % 2 ? 0.6 : -0.6] as THREE.Vector3Tuple), [])
  const beams = useMemo(() => [0.8, 2, 3.2].flatMap((y) => [0.6, -0.6].map((z) => [0, y, z] as THREE.Vector3Tuple)), [])
  const pallets = useMemo(() => Array.from({ length: bays * 3 }, (_, i) => [-4 + (i % bays) * 2, 1.05 + Math.floor(i / bays) * 1.2, 0] as THREE.Vector3Tuple)
    .filter((_, i) => (i * 7) % 5 !== 0), [])
  return (
    <group>
      <Instances geometry={box} material={MAT.rack} limit={uprights.length}>
        {uprights.map((p, i) => <Instance key={i} position={p} scale={[0.1, 4, 0.1]} />)}
      </Instances>
      <Instances geometry={box} material={MAT.rack} limit={beams.length}>
        {beams.map((p, i) => <Instance key={i} position={p} scale={[10, 0.12, 0.08]} />)}
      </Instances>
      <Instances geometry={box} material={MAT.pallet} limit={pallets.length}>
        {pallets.map((p, i) => <Instance key={i} position={p} scale={[1.6, 0.4, 1.1]} />)}
      </Instances>
    </group>
  )
}
