import type { CreativeAssetId } from './ids'
import type { Timestamp } from './serialization'

export type CreativeAssetKind = 'image' | 'photo' | 'product' | 'logo' | 'reference'
export type CreativeAssetSource = 'uploaded' | 'generated' | 'brand' | 'bundled'

export type CreativeAsset = {
  id: CreativeAssetId
  kind: CreativeAssetKind
  source: CreativeAssetSource
  storageRef: string
  mimeType: string
  width: number
  height: number
  byteSize?: number
  checksum?: string
  originalAssetId?: CreativeAssetId
  createdAt: Timestamp
  metadata?: {
    originalFileName?: string
    altText?: string
    subject?: string
  }
}

