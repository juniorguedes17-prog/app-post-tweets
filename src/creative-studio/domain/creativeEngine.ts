import type { BrandOverrides, BrandProfile } from './brandProfile'
import type { CanvasSpec } from './canvas'
import type { CreativeAsset } from './creativeAsset'
import type { CreativeBrief } from './creativeBrief'
import type { CreativeDirection } from './creativeDirection'
import type { CompositionRevision } from './composition'
import type { ElementLock } from './locks'
import type { GenerationMetadata } from './generation'
import type { VisualReference, ReferenceAnalysis } from './visualReference'

export type CreativeEngineInput = {
  brief: CreativeBrief
  canvas: CanvasSpec
  brandProfile?: BrandProfile
  brandOverrides?: BrandOverrides
  assets: CreativeAsset[]
  references?: VisualReference[]
  referenceAnalyses?: ReferenceAnalysis[]
  direction?: CreativeDirection
  previousRevision?: CompositionRevision
  locks: ElementLock[]
  refinementIntent?: string
}

export type CreativeEngineResult<T> = {
  output: T
  metadata: GenerationMetadata
}

/** Provider-agnostic boundary; no model SDK or network implementation belongs here. */
export interface CreativeEngineProvider {
  proposeDirections(input: CreativeEngineInput): Promise<CreativeEngineResult<CreativeDirection[]>>
  compose(input: CreativeEngineInput): Promise<CreativeEngineResult<CompositionRevision>>
  refine(input: CreativeEngineInput): Promise<CreativeEngineResult<CompositionRevision>>
  analyzeReference(input: CreativeEngineInput, reference: VisualReference): Promise<CreativeEngineResult<ReferenceAnalysis>>
}

