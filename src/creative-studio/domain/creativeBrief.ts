import type { CanvasSpec } from './canvas'
import type { CreativeBriefId, CreativeProjectId } from './ids'
import type { Timestamp } from './serialization'
import type { UGCIntensity } from './ugcGrammar'

export type CreativeObjective =
  | 'stop-scroll'
  | 'comments'
  | 'shares'
  | 'authority'
  | 'conversion'
  | 'desire'
  | (string & {})

export type CreativeStyle =
  | 'native-ugc'
  | 'tweet'
  | 'editorial'
  | 'product'
  | 'lifestyle'
  | 'storytelling'
  | (string & {})

export type CompositionStrategy =
  | 'auto'
  | 'centered'
  | 'asymmetric'
  | 'photo-dominant'
  | 'typography-dominant'
  | (string & {})

export type BrandPresence =
  | 'minimal'
  | 'normal'
  | 'none'
  | (string & {})

export type ImagePolicy = {
  originalRequired: boolean
  allowCrop: boolean
  allowBackgroundRemoval: boolean
  allowAiGeneration: boolean
}

export type CreativeBrief = {
  id: CreativeBriefId
  projectId: CreativeProjectId
  content: string
  headline: string
  body?: string
  cta?: string
  objective: CreativeObjective
  style: CreativeStyle
  ugcIntensity: UGCIntensity
  composition: CompositionStrategy
  brandPresence: BrandPresence
  imagePolicy: ImagePolicy
  canvas: CanvasSpec
  createdAt: Timestamp
  updatedAt: Timestamp
}

