import type { ColorPalette, ColorPaletteOverrides } from './colorPalette'
import type { CreativeAssetId, BrandProfileId, CompositionElementId } from './ids'
import type { AnnotationElementStyle, ImageElementStyle, ShapeElementStyle } from './sceneGraph'
import type { TextElementStyle, TypographyDefinition } from './typography'
import type { Timestamp } from './serialization'
import type { UGCDesignGrammar } from './ugcGrammar'

export type BrandTypography = {
  display: TypographyDefinition
  body: TypographyDefinition
  caption: TypographyDefinition
  allowedFonts: string[]
}

export type BrandTypographyOverrides = {
  display?: Partial<TypographyDefinition>
  body?: Partial<TypographyDefinition>
  caption?: Partial<TypographyDefinition>
  allowedFonts?: string[]
}

export type PhotographyTreatment =
  | 'native-instagram'
  | 'editorial-ugc'
  | 'minimal'
  | 'raw'
  | (string & {})

export type PhotographyRules = {
  preferredTreatment: PhotographyTreatment[]
  prohibitedTreatment: PhotographyTreatment[]
}

export type BrandProfile = {
  id: BrandProfileId
  name: string
  version: number
  palette: ColorPalette
  typography: BrandTypography
  logos: {
    primaryAssetId: CreativeAssetId
    alternateAssetIds: CreativeAssetId[]
  }
  photography: PhotographyRules
  /** P5 attaches the grammar configuration. A brand profile is valid before that phase. */
  ugcGrammar?: UGCDesignGrammar
  prohibitions: string[]
  officialReferenceAssetIds: CreativeAssetId[]
  allowAuthorizedOverrides: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
}

export type BrandProfilePreset = Omit<
  BrandProfile,
  'id' | 'logos' | 'officialReferenceAssetIds' | 'createdAt' | 'updatedAt'
>

export type ElementStyleOverride =
  | Partial<TextElementStyle>
  | Partial<ImageElementStyle>
  | Partial<ShapeElementStyle>
  | Partial<AnnotationElementStyle>

/** Customization hierarchy: Brand default → Project override → Element override. */
export type ProjectBrandOverrides = {
  palette?: ColorPaletteOverrides
  typography?: BrandTypographyOverrides
}

/** Customization hierarchy: Brand default → Project override → Element override. */
export type BrandOverrides = ProjectBrandOverrides & {
  elementOverrides?: Record<CompositionElementId, ElementStyleOverride>
}
