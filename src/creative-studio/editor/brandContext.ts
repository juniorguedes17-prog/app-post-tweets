import type { BrandOverrides, BrandProfile, BrandTypography } from '../domain/brandProfile'
import type { ColorPalette } from '../domain/colorPalette'

export function resolveEditorPalette(
  brandProfile?: BrandProfile,
  brandOverrides?: BrandOverrides,
): ColorPalette | undefined {
  if (!brandProfile) return undefined
  const overrides = brandOverrides?.palette
  return {
    ...brandProfile.palette,
    ...overrides,
    custom: {
      ...brandProfile.palette.custom,
      ...overrides?.custom,
    },
  }
}

export function resolveEditorTypography(
  brandProfile?: BrandProfile,
  brandOverrides?: BrandOverrides,
): BrandTypography | undefined {
  if (!brandProfile) return undefined
  const overrides = brandOverrides?.typography
  return {
    display: { ...brandProfile.typography.display, ...overrides?.display },
    body: { ...brandProfile.typography.body, ...overrides?.body },
    caption: { ...brandProfile.typography.caption, ...overrides?.caption },
    allowedFonts: overrides?.allowedFonts ?? brandProfile.typography.allowedFonts,
  }
}
