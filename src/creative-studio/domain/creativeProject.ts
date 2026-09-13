import type { BrandProfileId, CreativeDocumentId, CreativeProjectId } from './ids'
import type { Timestamp } from './serialization'
import type { CanvasSpec } from './canvas'

export type CreativeProjectStatus = 'draft' | 'active' | 'archived'

export type CreativeProject = {
  id: CreativeProjectId
  name: string
  createdAt: Timestamp
  updatedAt: Timestamp
  status: CreativeProjectStatus
  currentDocumentId?: CreativeDocumentId
  brandProfileId?: BrandProfileId
  canvas: CanvasSpec
  metadata?: {
    description?: string
    tags?: string[]
  }
}

