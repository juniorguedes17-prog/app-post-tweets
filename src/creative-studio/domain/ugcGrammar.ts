import type { UGCPreflightConfiguration } from './preflight'

/** TypeScript cannot enforce numeric intervals; runtime validation must enforce 0..1. */
export type Normalized01 = number

export type NativeInstagramGrammarParameters = {
  nativeAppearance: Normalized01
  advertisingAppearance: Normalized01
  brandIntensity: Normalized01
  visualSpontaneity: Normalized01
}

export type EditorialGrammarParameters = {
  hierarchyStrength: Normalized01
  negativeSpace: Normalized01
  visualDensity: Normalized01
  rhythm: Normalized01
  scaleContrast: Normalized01
  imageTextRatio: Normalized01
  editorialPolish: Normalized01
}

export type UGCHierarchyParameters = {
  headlineDominance: Normalized01
  photoDominance: Normalized01
  productProminence: Normalized01
  ctaProminence: Normalized01
}

export type UGCRawnessParameters = {
  gridRegularity: Normalized01
  asymmetry: Normalized01
  cropExpressiveness: Normalized01
  overlap: Normalized01
  controlledImperfection: Normalized01
}

export type UGCAnnotationKind =
  | 'handwritten-text'
  | 'arrow'
  | 'circle'
  | 'highlight'
  | 'underline'
  | 'scribble'

export type UGCAnnotationRule = {
  enabled: boolean
  frequency: Normalized01
  intensity: Normalized01
}

export type UGCAnnotationParameters = {
  frequency: Normalized01
  intensity: Normalized01
  /** Caps annotation presence so increased rawness does not imply visual pollution. */
  densityLimit: Normalized01
  kinds: Record<UGCAnnotationKind, UGCAnnotationRule>
}

export type UGCGrammarParameters = {
  native: NativeInstagramGrammarParameters
  editorial: EditorialGrammarParameters
  hierarchy: UGCHierarchyParameters
  rawness: UGCRawnessParameters
  annotations: UGCAnnotationParameters
}

export type UGCAnnotationOverrides = Partial<Omit<UGCAnnotationParameters, 'kinds'>> & {
  kinds?: Partial<Record<UGCAnnotationKind, Partial<UGCAnnotationRule>>>
}

export type UGCGrammarParameterOverrides = {
  native?: Partial<NativeInstagramGrammarParameters>
  editorial?: Partial<EditorialGrammarParameters>
  hierarchy?: Partial<UGCHierarchyParameters>
  rawness?: Partial<UGCRawnessParameters>
  annotations?: UGCAnnotationOverrides
}

export type UGCIntensity = {
  /** 0 is maximum Clean and 1 is maximum Raw; intermediate values are valid. */
  value: Normalized01
  /** Explicit exceptions applied after the future intensity-axis resolution. */
  overrides?: UGCGrammarParameterOverrides
}

/**
 * Structural endpoints for the continuous Clean ↔ Raw axis.
 * A future runtime resolver may interpolate these values; this domain contract performs no calculation.
 */
export type UGCIntensityAxis = {
  clean: UGCGrammarParameters
  raw: UGCGrammarParameters
}

/** Serializable configuration only; it contains no prompt, template, renderer, or generation algorithm. */
export type UGCDesignGrammar = {
  version: string
  defaultIntensity: UGCIntensity
  defaultParameters: UGCGrammarParameters
  intensityAxis: UGCIntensityAxis
  preflight: UGCPreflightConfiguration
}
