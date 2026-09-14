import type { BrandOverrides } from './brandProfile'
import type { CanvasSpec } from './canvas'
import type { CreativeBriefId, CreativeAssetId, BrandProfileId, CompositionId, CompositionRevisionId, CreativeDirectionId, CreativeDocumentId, CreativeProjectId, VisualReferenceId } from './ids'
import type { Timestamp } from './serialization'

export type CreativeDocumentPage = {
  compositionId: CompositionId
  revisionId: CompositionRevisionId
  canvas: CanvasSpec
}

/** IDs keep the document lightweight and prevent duplicated mutable domain objects. */
export type CreativeDocument = {
  id: CreativeDocumentId
  projectId: CreativeProjectId
  briefId: CreativeBriefId
  compositionId: CompositionId
  currentRevisionId: CompositionRevisionId
  /** Optional for backward compatibility with documents persisted before multipage support. */
  pages?: CreativeDocumentPage[]
  brandProfileId?: BrandProfileId
  brandOverrides?: BrandOverrides
  assetIds: CreativeAssetId[]
  referenceIds: VisualReferenceId[]
  selectedDirectionId?: CreativeDirectionId
  createdAt: Timestamp
  updatedAt: Timestamp
}
