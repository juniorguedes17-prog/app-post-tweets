import type { CreativeAssetId, CompositionElementId } from './ids'
import type { TextElementStyle } from './typography'

export type SemanticRole =
  | 'headline'
  | 'body'
  | 'cta'
  | 'product'
  | 'photo'
  | 'logo'
  | 'annotation'
  | 'background'
  | 'decoration'
  | (string & {})

export type CompositionElementType =
  | 'text'
  | 'image'
  | 'photo'
  | 'product'
  | 'logo'
  | 'shape'
  | 'annotation'
  | 'group'

export type ElementLockState = 'unlocked' | 'locked'

export type CompositionElementBase = {
  id: CompositionElementId
  semanticRole: SemanticRole
  x: number
  y: number
  width: number
  height: number
  rotation: number
  zIndex: number
  /** Normalized opacity, expected to be 0..1 at runtime. */
  opacity: number
  visible: boolean
  /** Informational UI state; ElementLock is the authoritative lock contract. */
  lockState: ElementLockState
}

export type TextElement = CompositionElementBase & {
  type: 'text'
  content: string
  style: TextElementStyle
}

export type CropSpec = {
  x: number
  y: number
  zoom: number
}

export type ImageFit = 'cover' | 'contain' | 'fill'

export type ImageElementStyle = {
  fit: ImageFit
  /** Every visual asset carries an explicit crop state, including the neutral x:0/y:0/zoom:1 state. */
  crop: CropSpec
  /** Use 0 when no rounding is desired so the visual result remains fully serializable. */
  borderRadius: number
}

export type ImageElement = CompositionElementBase & {
  type: 'image'
  assetId: CreativeAssetId
  style: ImageElementStyle
}

export type PhotoElement = CompositionElementBase & {
  type: 'photo'
  assetId: CreativeAssetId
  style: ImageElementStyle
}

export type ProductElement = CompositionElementBase & {
  type: 'product'
  assetId: CreativeAssetId
  style: ImageElementStyle
}

export type LogoElement = CompositionElementBase & {
  type: 'logo'
  assetId: CreativeAssetId
  style: ImageElementStyle
}

export type ShapeKind = 'rectangle' | 'circle' | 'line' | 'blob' | (string & {})

export type ShapeElementStyle = {
  shape: ShapeKind
  fill?: string
  stroke?: string
  strokeWidth?: number
}

export type ShapeElement = CompositionElementBase & {
  type: 'shape'
  style: ShapeElementStyle
}

export type AnnotationKind =
  | 'text'
  | 'handwritten-text'
  | 'arrow'
  | 'circle'
  | 'highlight'
  | 'underline'
  | 'scribble'
  | (string & {})

export type AnnotationElementStyle = {
  kind: AnnotationKind
  color?: string
  strokeWidth?: number
}

export type AnnotationElement = CompositionElementBase & {
  type: 'annotation'
  content?: string
  assetId?: CreativeAssetId
  style: AnnotationElementStyle
}

export type GroupElement = CompositionElementBase & {
  type: 'group'
  /** References only. Future validation must reject duplicates, self-references, and group cycles. */
  children: CompositionElementId[]
}

export type CompositionElement =
  | TextElement
  | ImageElement
  | PhotoElement
  | ProductElement
  | LogoElement
  | ShapeElement
  | AnnotationElement
  | GroupElement
