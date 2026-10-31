// Mirrors backend DTOs (camelCase JSON, enums as strings).

export type MachineStatus = 'Normal' | 'Warning' | 'Critical' | 'Offline' | 'Unknown'
export type DataOrigin = 'Synthetic' | 'Real'
/** Plant-level classification (every record of the demo plant is SYNTHETIC, including user-created ones). */
export type DataClassification = 'SYNTHETIC' | 'REAL'
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
  dataClassification: DataClassification
  lastReadingUtc: string | null
  openAlertCount: number
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
  dataClassification: DataClassification
}

export interface MachineDetail {
  machine: MachineSummary
  sensors: Sensor[]
  recentMaintenance: MaintenanceRecord[]
  generatedAt: string
  dataClassification: DataClassification
}

export interface Zone {
  id: string
  name: string
  description: string | null
  machineCount: number
  statusCounts: Partial<Record<MachineStatus, number>>
  dataOrigin: DataOrigin
  dataClassification: DataClassification
}

export interface Health {
  status: 'ok' | 'degraded'
  database: 'ok' | 'unavailable'
  demoData: { seedBatchId: string; anchorUtc: string; seededUtc: string } | null
  features: { ai: boolean; embeddings: boolean; mlServiceUrl: string; devUsers: boolean }
  ml: MlStatus
  timestampUtc: string
}

export interface MlStatus {
  available: boolean
  message: string
  lastCheckedUtc: string | null
}

export type AlertSeverity = 'Warning' | 'Critical'
export type AlertStatus = 'Open' | 'Acknowledged' | 'Resolved'

export interface AlertHistory {
  newStatus: AlertStatus
  userName: string
  comment: string | null
  timestampUtc: string
}

export interface Alert {
  id: string
  machineId: string
  machineName: string
  sensorId: string
  measurement: string
  unit: string
  severity: AlertSeverity
  observedValue: number
  threshold: number
  detectedUtc: string
  status: AlertStatus
  resolvedUtc: string | null
  dataOrigin: DataOrigin
  dataClassification: DataClassification
  history: AlertHistory[]
}

/** A bucket with count 0 has null values: it is a gap, drawn as a gap. */
export interface SeriesPoint {
  t: string
  avg: number | null
  min: number | null
  max: number | null
  count: number
}

export interface SensorSeries {
  sensorId: string
  measurement: string
  unit: string
  warningMin: number | null
  warningMax: number | null
  criticalMin: number | null
  criticalMax: number | null
  points: SeriesPoint[]
}

export type ReadingsRange = '1h' | '24h' | '7d'

export interface ReadingsResponse {
  machineId: string
  range: ReadingsRange
  fromUtc: string
  toUtc: string
  bucketSeconds: number
  dataOrigin: DataOrigin
  dataClassification: DataClassification
  sensors: SensorSeries[]
}

export type ObservationStatus = 'Open' | 'InProgress' | 'Resolved' | 'Closed'
export type ObservationPriority = 'Low' | 'Medium' | 'High' | 'Critical'

export interface InspectionZone {
  id: string
  name: string
  total: number
  open: number
  openHighPriority: number
  dataClassification: DataClassification
}

export interface ObservationSummary {
  id: string
  code: string
  zoneId: string
  zoneName: string
  machineId: string | null
  category: string
  priority: ObservationPriority
  status: ObservationStatus
  description: string
  assignedRole: string | null
  assignedUser: string | null
  createdUtc: string
  updatedUtc: string
  openActions: number
  dataOrigin: DataOrigin
  dataClassification: DataClassification
}

export interface ObservationDetail {
  observation: ObservationSummary
  inspectionTitle: string
  inspectorName: string | null
  inspectionUtc: string
  correctiveActions: { id: string; description: string; status: string; assignedRole: string | null; createdUtc: string; dueUtc: string | null; completedUtc: string | null; overdue: boolean }[]
  attachments: { id: string; fileName: string; caption: string; isPlaceholder: boolean; url: string }[]
  history: { timestampUtc: string; userName: string; action: string; details: string | null }[]
}

export interface InspectionSummary {
  scope: string
  generatedUtc: string
  total: number
  byStatus: Record<ObservationStatus, number>
  openByPriority: Record<ObservationPriority, number>
  openHighPriority: { code: string; id: string; zoneId: string; machineId: string | null; priority: ObservationPriority; status: ObservationStatus; description: string }[]
  overdueActions: number
  lines: string[]
  focusEntityIds: string[]
  dataClassification: DataClassification
}

export interface AnomalyScore {
  score: number
  threshold: number
  maxFeatureZ: number | null
  zThreshold: number | null
  isAnomaly: boolean
  modelVersion: string
  timestampUtc: string
  topDeviations: { feature: string; value: number; zScore: number }[]
  isFresh: boolean
}

export interface PredictiveListItem {
  machineId: string
  name: string
  status: MachineStatus
  latestScore: AnomalyScore | null
  dataClassification: DataClassification
}

export interface Predictive {
  machine: MachineSummary
  ml: MlStatus
  latestScore: AnomalyScore | null
  scoreHistory: AnomalyScore[]
  trends: { sensorId: string; measurement: string; unit: string; state: SensorState; trend: { slopePerHour: number; changePercent: number; notable: boolean; direction: string } | null; firstHourAvg: number | null; lastHourAvg: number | null }[]
  patternsObserved: string[]
  suggestedActions: { ruleId: string; action: string; trigger: string }[]
  dataQualityWarnings: string[]
  openAlerts: Alert[]
  maintenanceHistory: MaintenanceRecord[]
  reviewLabel: string
  failurePrediction: string
  generatedAt: string
  dataClassification: DataClassification
}

export type ReportType = 'FactoryHealth' | 'MachineAnomalies' | 'MaintenanceHistory' | 'SiteInspection'

export interface ReportDocument {
  title: string
  type: ReportType
  generatedUtc: string
  fromUtc: string
  toUtc: string
  filters: Record<string, string>
  summary: string[]
  sections: { heading: string; paragraphs: string[]; table: { columns: string[]; rows: string[][] } | null }[]
  recommendations: string[]
  dataSource: string
  dataClassification: DataClassification
}

export interface Report {
  id: string
  status: 'Draft' | 'Final'
  generatedBy: string | null
  document: ReportDocument
}

export interface ReportListItem {
  id: string
  type: ReportType
  status: 'Draft' | 'Final'
  title: string
  generatedUtc: string
  generatedBy: string | null
}
