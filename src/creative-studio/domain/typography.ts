export type TextAlign = 'left' | 'center' | 'right'

/** Brand typography supplies defaults; it does not prescribe final element dimensions. */
export type TypographyDefinition = {
  fontFamily: string
  fontWeight: number
  lineHeight?: number
  letterSpacing?: number
  textAlign?: TextAlign
}

/** Final text styling belongs to the element and may override brand/project defaults. */
export type TextElementStyle = {
  fontFamily: string
  fontWeight: number
  fontSize: number
  lineHeight: number
  letterSpacing: number
  textAlign: TextAlign
  color: string
}

