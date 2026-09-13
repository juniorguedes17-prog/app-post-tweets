import type { CreativeAssetId, VisualReferenceId } from './ids'
import type { Timestamp } from './serialization'
import type { Normalized01 } from './ugcGrammar'

export type ReferenceRhythm = 'slow' | 'balanced' | 'fast' | 'irregular' | (string & {})

/** Analysis describes abstract visual attributes; it is not a copied template or coordinate map. */
export type ReferenceAnalysis = {
  hierarchy: string[]
  imageTextRatio: Normalized01
  visualDensity: Normalized01
  negativeSpace: Normalized01
  asymmetry: Normalized01
  typographyCharacter: string[]
  annotationPresence: Normalized01
  rhythm: ReferenceRhythm
  ugcFeeling: Normalized01
  analyzedAt: Timestamp
  analyzerVersion: string
}

export type VisualReference = {
  id: VisualReferenceId
  assetId: CreativeAssetId
  purpose?: string
  analysis?: ReferenceAnalysis
  createdAt: Timestamp
  updatedAt: Timestamp
}

