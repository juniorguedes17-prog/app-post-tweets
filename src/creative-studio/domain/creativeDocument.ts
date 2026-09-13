import type { BrandOverrides } from './brandProfile'
import type { CreativeBriefId, CreativeAssetId, BrandProfileId, CompositionId, CompositionRevisionId, CreativeDirectionId, CreativeDocumentId, CreativeProjectId, VisualReferenceId } from './ids'
import type { Timestamp } from './serialization'

/** IDs keep the document lightweight and prevent duplicated mutable domain objects. */
export type CreativeDocument = {
  id: CreativeDocumentId
  projectId: CreativeProjectId
  briefId: CreativeBriefId
  compositionId: CompositionId
  currentRevisionId: CompositionRevisionId
  brandProfileId?: BrandProfileId
  brandOverrides?: BrandOverrides
  assetIds: CreativeAssetId[]
  referenceIds: VisualReferenceId[]
  selectedDirectionId?: CreativeDirectionId
  createdAt: Timestamp
  updatedAt: Timestamp
}

