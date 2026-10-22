// Mirrors backend DTOs (camelCase JSON, enums as strings).

export type MachineStatus = 'Normal' | 'Warning' | 'Critical' | 'Offline' | 'Unknown'
export type DataOrigin = 'Synthetic' | 'Real'
export type SensorState = 'Normal' | 'Warning' | 'Critical' | 'Missing'

export interface MachineSummary {
  id: string
  name: string
  typeId: string
  typeName: string
  zoneId: string
  zoneName: string
  status: MachineStatus
  statusReasons: string[]
  maintenanceStatus: string
  isFlaggedOffline: boolean
  manufacturer: string
  model: string
  dataOrigin: DataOrigin
  lastReadingUtc: string | null
}

export interface Sensor {
  id: string
  measurement: string
  unit: string
  isRequired: boolean
  warningMin: number | null
  warningMax: number | null
  criticalMin: number | null
  criticalMax: number | null
  latestValue: number | null
  latestTimestampUtc: string | null
  state: SensorState
}

export interface MaintenanceRecord {
  id: string
  machineId: string
  type: string
  description: string
  performedBy: string | null
  performedUtc: string
  durationHours: number
  outcome: string | null
  dataOrigin: DataOrigin
}

export interface MachineDetail {
  machine: MachineSummary
  sensors: Sensor[]
  recentMaintenance: MaintenanceRecord[]
}

export interface Zone {
  id: string
  name: string
  description: string | null
  machineCount: number
  statusCounts: Partial<Record<MachineStatus, number>>
  dataOrigin: DataOrigin
}

export interface Health {
  status: 'ok' | 'degraded'
  database: 'ok' | 'unavailable'
  demoData: { seedBatchId: string; anchorUtc: string; seededUtc: string } | null
  features: { ai: boolean; embeddings: boolean; mlServiceUrl: string; devUsers: boolean }
  timestampUtc: string
}
