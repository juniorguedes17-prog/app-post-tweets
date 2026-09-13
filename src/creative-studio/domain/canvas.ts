export type CanvasFormat =
  | 'feed-4-5'
  | 'story-9-16'
  | 'square-1-1'
  | 'tweet-card'
  | 'custom'

export type CanvasSpec = {
  format: CanvasFormat
  width: number
  height: number
  background: string
}

