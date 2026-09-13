import type { CompositionStrategy, BrandPresence } from './creativeBrief'
import type { CreativeAssetId, CreativeDirectionId, GenerationId, CreativeProjectId } from './ids'
import type { SemanticRole } from './sceneGraph'
import type { Timestamp } from './serialization'
import type { UGCIntensity } from './ugcGrammar'

export type ImageTreatment = {
  dominant: boolean
  modes: string[]
  notes?: string
}

export type CreativeDirection = {
  id: CreativeDirectionId
  projectId: CreativeProjectId
  name: string
  concept: string
  rationale: string
  hierarchy: string[]
  imageTreatment: ImageTreatment
  compositionStrategy: CompositionStrategy
  typographyCharacter: string[]
  ugcIntensity: UGCIntensity
  brandPresence: BrandPresence
  preservedRoles: SemanticRole[]
  variableRoles: SemanticRole[]
  previewAssetId?: CreativeAssetId
  generationId?: GenerationId
  createdAt: Timestamp
}

