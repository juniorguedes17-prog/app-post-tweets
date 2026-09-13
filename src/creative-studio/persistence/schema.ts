import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { BrandProfile } from '../domain/brandProfile'
import type { CreativeAsset } from '../domain/creativeAsset'
import type { CreativeBrief } from '../domain/creativeBrief'
import type { CreativeDirection } from '../domain/creativeDirection'
import type { CreativeDocument } from '../domain/creativeDocument'
import type { CreativeProject } from '../domain/creativeProject'
import type { Composition, CompositionRevision } from '../domain/composition'
import type {
  BrandProfileId,
  CompositionElementId,
  CompositionId,
  CompositionRevisionId,
  CreativeAssetId,
  CreativeBriefId,
  CreativeDirectionId,
  CreativeDocumentId,
  CreativeProjectId,
  VisualReferenceId,
} from '../domain/ids'
import type { CompositionElement } from '../domain/sceneGraph'
import type { Timestamp } from '../domain/serialization'
import type { VisualReference } from '../domain/visualReference'

export const CREATIVE_STUDIO_DATABASE_NAME = 'inest-creative-studio'
export const CREATIVE_STUDIO_DATABASE_VERSION = 1

/** Binary data is intentionally isolated from CreativeAsset metadata and scene-graph elements. */
export type CreativeAssetBytesRecord = {
  assetId: CreativeAssetId
  bytes: Blob
  updatedAt: Timestamp
}

/**
 * Mutable editor draft. It references an immutable base revision and is never stored as a
 * CompositionRevision, so autosave cannot rewrite history.
 */
export type CreativeWorkingState = {
  documentId: CreativeDocumentId
  projectId: CreativeProjectId
  compositionId: CompositionId
  baseRevisionId: CompositionRevisionId
  elements: CompositionElement[]
  updatedAt: Timestamp
}

export interface CreativeStudioDatabaseSchema extends DBSchema {
  projects: {
    key: CreativeProjectId
    value: CreativeProject
  }
  briefs: {
    key: CreativeBriefId
    value: CreativeBrief
    indexes: { 'by-project': CreativeProjectId }
  }
  documents: {
    key: CreativeDocumentId
    value: CreativeDocument
    indexes: { 'by-project': CreativeProjectId }
  }
  compositions: {
    key: CompositionId
    value: Composition
    indexes: { 'by-project': CreativeProjectId }
  }
  'composition-revisions': {
    key: CompositionRevisionId
    value: CompositionRevision
    indexes: { 'by-composition': CompositionId }
  }
  assets: {
    key: CreativeAssetId
    value: CreativeAsset
  }
  'asset-bytes': {
    key: CreativeAssetId
    value: CreativeAssetBytesRecord
  }
  references: {
    key: VisualReferenceId
    value: VisualReference
  }
  directions: {
    key: CreativeDirectionId
    value: CreativeDirection
    indexes: { 'by-project': CreativeProjectId }
  }
  'brand-profiles': {
    key: BrandProfileId
    value: BrandProfile
  }
  'working-states': {
    key: CreativeDocumentId
    value: CreativeWorkingState
    indexes: { 'by-project': CreativeProjectId }
  }
}

const databasePromises = new Map<string, Promise<IDBPDatabase<CreativeStudioDatabaseSchema>>>()

/**
 * The default database is independent from the legacy inest-tweet-cards database.
 * The optional name exists only to permit isolated technical verification.
 */
export function openCreativeStudioDatabase(
  databaseName = CREATIVE_STUDIO_DATABASE_NAME,
): Promise<IDBPDatabase<CreativeStudioDatabaseSchema>> {
  const existing = databasePromises.get(databaseName)
  if (existing) return existing

  const database = openDB<CreativeStudioDatabaseSchema>(databaseName, CREATIVE_STUDIO_DATABASE_VERSION, {
    upgrade(db) {
      db.createObjectStore('projects')
      db.createObjectStore('briefs').createIndex('by-project', 'projectId')
      db.createObjectStore('documents').createIndex('by-project', 'projectId')
      db.createObjectStore('compositions').createIndex('by-project', 'projectId')
      db.createObjectStore('composition-revisions').createIndex('by-composition', 'compositionId')
      db.createObjectStore('assets')
      db.createObjectStore('asset-bytes')
      db.createObjectStore('references')
      db.createObjectStore('directions').createIndex('by-project', 'projectId')
      db.createObjectStore('brand-profiles')
      db.createObjectStore('working-states').createIndex('by-project', 'projectId')
    },
  })

  databasePromises.set(databaseName, database)
  return database
}

export type { CompositionElementId }
