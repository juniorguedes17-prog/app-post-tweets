import type { BrandProfile } from '../domain/brandProfile'
import type { CreativeAsset } from '../domain/creativeAsset'
import type { CreativeBrief } from '../domain/creativeBrief'
import type { CreativeDirection } from '../domain/creativeDirection'
import type { CreativeDocument } from '../domain/creativeDocument'
import type { CreativeProject } from '../domain/creativeProject'
import type { Composition, CompositionRevision } from '../domain/composition'
import type { CreativeAssetId } from '../domain/ids'
import type { ElementLock } from '../domain/locks'
import type { VisualReference } from '../domain/visualReference'
import type { CreativeWorkingState } from './schema'

/** Persistable aggregate used when a document is first created or its metadata changes. */
export type CreativeProjectBundle = {
  project: CreativeProject
  brief: CreativeBrief
  document: CreativeDocument
  composition: Composition
  currentRevision: CompositionRevision
  brandProfile?: BrandProfile
  assets?: CreativeAsset[]
  references?: VisualReference[]
  directions?: CreativeDirection[]
  locks?: ElementLock[]
}

/** Read model required to rehydrate a CreativeDocument without loading image bytes eagerly. */
export type RestoredCreativeDocument = {
  project: CreativeProject
  brief: CreativeBrief
  document: CreativeDocument
  composition: Composition
  currentRevision: CompositionRevision
  workingState?: CreativeWorkingState
  brandProfile?: BrandProfile
  assets: CreativeAsset[]
  missingAssetIds: CreativeAssetId[]
  references: VisualReference[]
  selectedDirection?: CreativeDirection
  locks: ElementLock[]
}
