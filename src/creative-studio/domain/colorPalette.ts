export type ColorPalette = {
  primary: string
  secondary: string
  accent: string
  background: string
  text: string
  muted: string
  /** Additional named colors are semantic project/brand tokens, not an anonymous color list. */
  custom: Record<string, string>
}

export type ColorPaletteOverrides = Partial<Omit<ColorPalette, 'custom'>> & {
  custom?: Record<string, string>
}

