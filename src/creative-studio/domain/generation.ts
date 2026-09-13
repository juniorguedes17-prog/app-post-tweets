import type { CreativeDirectionId, CompositionRevisionId, CreativeAssetId, GenerationId, GenerationVariantId, CreativeProjectId, VisualReferenceId, CompositionId } from './ids'
import type { CreativeBrief } from './creativeBrief'
import type { BrandOverrides, BrandProfile } from './brandProfile'
import type { ElementLock } from './locks'
import type { CanvasSpec } from './canvas'
import type { JsonValue, Timestamp } from './serialization'

export type GenerationStatus = 'pending' | 'running' | 'completed' | 'failed' | 'rejected'
export type GenerationKind = 'directions' | 'composition' | 'refinement' | 'reference-analysis'

export type GenerationMetadata = {
  provider?: string
  model?: string
  modelVersion?: string
  requestId?: string
  durationMs?: number
  parameters?: Record<string, JsonValue>
}

export type GenerationInputSnapshot = {
  brief: CreativeBrief
  canvas: CanvasSpec
  brandProfile?: BrandProfile
  brandOverrides?: BrandOverrides
  assetIds: CreativeAssetId[]
  referenceIds: VisualReferenceId[]
  directionId?: CreativeDirectionId
  compositionId?: CompositionId
  baseRevisionId?: CompositionRevisionId
  locks: ElementLock[]
  refinementIntent?: string
}

export type GenerationOutputReferences = {
  directionIds?: CreativeDirectionId[]
  variantIds: GenerationVariantId[]
  compositionRevisionId?: CompositionRevisionId
}

export type Generation = {
  id: GenerationId
  projectId: CreativeProjectId
  status: GenerationStatus
  kind: GenerationKind
  createdAt: Timestamp
  completedAt?: Timestamp
  input: GenerationInputSnapshot
  output?: GenerationOutputReferences
  metadata?: GenerationMetadata
  error?: {
    code?: string
    message: string
  }
}

export type GenerationVariant = {
  id: GenerationVariantId
  generationId: GenerationId
  kind: GenerationKind
  directionId?: CreativeDirectionId
  compositionRevisionId?: CompositionRevisionId
  previewAssetId?: CreativeAssetId
  createdAt: Timestamp
  metadata?: GenerationMetadata
}

