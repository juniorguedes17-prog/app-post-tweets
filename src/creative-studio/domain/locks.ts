import type { CreativeAssetId, CompositionElementId, CompositionId, CompositionRevisionId, ElementLockId } from './ids'
import type { AnnotationElementStyle, CropSpec, ImageElementStyle, ShapeElementStyle } from './sceneGraph'
import type { TextElementStyle } from './typography'
import type { Timestamp } from './serialization'

export type LockScope =
  | 'content'
  | 'asset'
  | 'position'
  | 'dimensions'
  | 'crop'
  | 'scale'
  | 'style'
  | 'element'

export type Point = { x: number; y: number }
export type Dimensions = { width: number; height: number }
/** Presentation properties live on every scene element and are protected by a style lock. */
export type ElementPresentationSnapshot = {
  rotation?: number
  opacity?: number
  visible?: boolean
}

export type ElementStyleSnapshot = ElementPresentationSnapshot &
  (
    | Partial<TextElementStyle>
    | Partial<ImageElementStyle>
    | Partial<ShapeElementStyle>
    | Partial<AnnotationElementStyle>
  )

export type ElementLockSnapshot = {
  content?: string
  assetId?: CreativeAssetId
  position?: Point
  dimensions?: Dimensions
  crop?: CropSpec
  scale?: number
  style?: ElementStyleSnapshot
  elementFingerprint?: string
}

/** Element lock state is granular and authoritative outside the scene-graph UI hint. */
export type ElementLock = {
  id: ElementLockId
  compositionId: CompositionId
  revisionId: CompositionRevisionId
  elementId: CompositionElementId
  scopes: LockScope[]
  protectedSnapshot: ElementLockSnapshot
  protectedHash?: string
  createdAt: Timestamp
}

export type InvariantViolation = {
  elementId: CompositionElementId
  scope: LockScope
  expected: string
  received: string
}

export type InvariantValidation = {
  valid: boolean
  violations: InvariantViolation[]
  checkedRevisionId: CompositionRevisionId
  validatedAt: Timestamp
}
