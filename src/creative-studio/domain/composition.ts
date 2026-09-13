import type { CanvasSpec } from './canvas'
import type { CreativeDirectionId, CompositionId, CompositionRevisionId, CreativeProjectId, GenerationId } from './ids'
import type { CompositionElement } from './sceneGraph'
import type { Timestamp } from './serialization'

export type Composition = {
  id: CompositionId
  projectId: CreativeProjectId
  canvas: CanvasSpec
  sourceDirectionId?: CreativeDirectionId
  currentRevisionId: CompositionRevisionId
  createdAt: Timestamp
  updatedAt: Timestamp
}

export type CompositionRevisionOrigin =
  | 'initial'
  | 'manual-edit'
  | 'generation'
  | 'refinement'
  | 'restore'
  | (string & {})

/** A revision is immutable history; generation must create a new revision. */
export type CompositionRevision = {
  id: CompositionRevisionId
  compositionId: CompositionId
  revisionNumber: number
  elements: CompositionElement[]
  createdAt: Timestamp
  origin: CompositionRevisionOrigin
  generationId?: GenerationId
  parentRevisionId?: CompositionRevisionId
  label?: string
}

