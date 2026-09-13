import type { BrandProfile, BrandProfilePreset, BrandTypography, PhotographyRules } from './brandProfile'
import type { BrandProfileId, CreativeAssetId } from './ids'
import type { Timestamp } from './serialization'
import { INEST_UGC_DESIGN_GRAMMAR } from './inestUgcGrammar'

const inestTypography: BrandTypography = {
  display: {
    fontFamily: 'Montserrat',
    fontWeight: 700,
    lineHeight: 1.1,
    letterSpacing: -0.02,
    textAlign: 'left',
  },
  body: {
    fontFamily: 'Inter',
    fontWeight: 400,
    lineHeight: 1.4,
    letterSpacing: 0,
    textAlign: 'left',
  },
  caption: {
    fontFamily: 'Inter',
    fontWeight: 500,
    lineHeight: 1.2,
    letterSpacing: 0,
    textAlign: 'left',
  },
  allowedFonts: ['Montserrat', 'Inter'],
}

const inestPhotography: PhotographyRules = {
  preferredTreatment: ['native-instagram', 'editorial-ugc', 'minimal', 'raw'],
  prohibitedTreatment: ['stock-photo', 'over-retouched', 'ecommerce-banner', 'generic-advertising'],
}

/** A serializable preset. Logo asset IDs are provided when a concrete profile is created. */
export const INEST_BRAND_PRESET: BrandProfilePreset = {
  name: 'iNest',
  version: 1,
  palette: {
    primary: '#5F7CFF',
    secondary: '#7B2CFF',
    accent: '#7B2CFF',
    background: '#F5F7FA',
    text: '#050505',
    muted: '#5F7CFF',
    custom: {
      blueGlow: '#5F7CFF',
      purpleTech: '#7B2CFF',
      iceWhite: '#F5F7FA',
      deepBlack: '#050505',
    },
  },
  typography: inestTypography,
  photography: inestPhotography,
  ugcGrammar: INEST_UGC_DESIGN_GRAMMAR,
  prohibitions: ['reference-copy'],
  allowAuthorizedOverrides: true,
}

export type CreateInestBrandProfileInput = {
  id: BrandProfileId
  primaryLogoAssetId: CreativeAssetId
  alternateLogoAssetIds?: CreativeAssetId[]
  officialReferenceAssetIds?: CreativeAssetId[]
  createdAt: Timestamp
  updatedAt: Timestamp
}

/** The returned BrandProfile remains editable through ProjectBrandOverrides and element overrides. */
export function createInestBrandProfile(input: CreateInestBrandProfileInput): BrandProfile {
  return {
    ...INEST_BRAND_PRESET,
    palette: {
      ...INEST_BRAND_PRESET.palette,
      custom: { ...INEST_BRAND_PRESET.palette.custom },
    },
    typography: {
      ...INEST_BRAND_PRESET.typography,
      display: { ...INEST_BRAND_PRESET.typography.display },
      body: { ...INEST_BRAND_PRESET.typography.body },
      caption: { ...INEST_BRAND_PRESET.typography.caption },
      allowedFonts: [...INEST_BRAND_PRESET.typography.allowedFonts],
    },
    photography: {
      preferredTreatment: [...INEST_BRAND_PRESET.photography.preferredTreatment],
      prohibitedTreatment: [...INEST_BRAND_PRESET.photography.prohibitedTreatment],
    },
    prohibitions: [...INEST_BRAND_PRESET.prohibitions],
    id: input.id,
    logos: {
      primaryAssetId: input.primaryLogoAssetId,
      alternateAssetIds: [...(input.alternateLogoAssetIds ?? [])],
    },
    officialReferenceAssetIds: [...(input.officialReferenceAssetIds ?? [])],
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  }
}
