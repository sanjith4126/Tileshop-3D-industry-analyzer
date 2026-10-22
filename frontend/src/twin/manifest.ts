import { useQuery } from '@tanstack/react-query'
import { apiGet } from '../api/client'

export type Vec3 = [number, number, number]

export type EntityType = 'Zone' | 'HydraulicPress' | 'Pump' | 'Motor' | 'Conveyor' | 'InspectionStation' | 'Kiln' | 'RackRow'

export interface ManifestEntity {
  type: EntityType
  /** Relative to the 3d-assets folder; when set, a GLB is loaded instead of procedural geometry. */
  modelPath?: string
  position: Vec3
  rotation: Vec3
  scale: Vec3
}

export interface AssetManifest {
  version: number
  building: { size: Vec3 }
  entities: Record<string, ManifestEntity>
}

export const ASSETS_BASE = '/assets3d'

export const useManifest = () =>
  useQuery({
    queryKey: ['asset-manifest'],
    queryFn: ({ signal }) => apiGet<AssetManifest>(`${ASSETS_BASE}/asset-manifest.json`, signal),
    staleTime: Infinity,
  })
