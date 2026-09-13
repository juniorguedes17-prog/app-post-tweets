import type { CreativeAsset, CreativeAssetKind } from '../domain/creativeAsset'
import type { CreativeDocument } from '../domain/creativeDocument'
import type {
  CreativeAssetId,
  CreativeDirectionId,
  VisualReferenceId,
} from '../domain/ids'
import type { Timestamp } from '../domain/serialization'
import type { VisualReference } from '../domain/visualReference'

export type UploadedImageDescriptor = {
  id: CreativeAssetId
  kind: CreativeAssetKind
  fileName: string
  mimeType: string
  width: number
  height: number
  byteSize: number
  createdAt: Timestamp
}

export function createUploadedImageAsset(descriptor: UploadedImageDescriptor): CreativeAsset {
  return {
    id: descriptor.id,
    kind: descriptor.kind,
    source: 'uploaded',
    storageRef: `indexeddb://assets/${descriptor.id}`,
    mimeType: descriptor.mimeType,
    width: descriptor.width,
    height: descriptor.height,
    byteSize: descriptor.byteSize,
    createdAt: descriptor.createdAt,
    metadata: { originalFileName: descriptor.fileName },
  }
}

export function createVisualReference(input: {
  id: VisualReferenceId
  assetId: CreativeAssetId
  purpose?: string
  createdAt: Timestamp
}): VisualReference {
  return {
    id: input.id,
    assetId: input.assetId,
    ...(input.purpose?.trim() ? { purpose: input.purpose.trim() } : {}),
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  }
}

export function attachAsset(
  document: CreativeDocument,
  assetId: CreativeAssetId,
  updatedAt: Timestamp,
): CreativeDocument {
  return {
    ...document,
    assetIds: [...new Set([...document.assetIds, assetId])],
    updatedAt,
  }
}

export function detachAsset(
  document: CreativeDocument,
  assetId: CreativeAssetId,
  updatedAt: Timestamp,
): CreativeDocument {
  return {
    ...document,
    assetIds: document.assetIds.filter((id) => id !== assetId),
    updatedAt,
  }
}

export function attachReference(
  document: CreativeDocument,
  reference: VisualReference,
  updatedAt: Timestamp,
): CreativeDocument {
  const withAsset = attachAsset(document, reference.assetId, updatedAt)
  return {
    ...withAsset,
    referenceIds: [...new Set([...withAsset.referenceIds, reference.id])],
  }
}

export function detachReference(
  document: CreativeDocument,
  reference: VisualReference,
  updatedAt: Timestamp,
): CreativeDocument {
  return {
    ...detachAsset(document, reference.assetId, updatedAt),
    referenceIds: document.referenceIds.filter((id) => id !== reference.id),
  }
}

export function selectCreativeDirection(
  document: CreativeDocument,
  selectedDirectionId: CreativeDirectionId | undefined,
  updatedAt: Timestamp,
): CreativeDocument {
  return {
    ...document,
    ...(selectedDirectionId ? { selectedDirectionId } : { selectedDirectionId: undefined }),
    updatedAt,
  }
}
