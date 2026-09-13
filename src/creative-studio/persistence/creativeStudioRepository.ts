import type { IDBPObjectStore, StoreNames } from 'idb'
import type { CreativeAsset } from '../domain/creativeAsset'
import type { CreativeDocument } from '../domain/creativeDocument'
import type { Composition, CompositionRevision } from '../domain/composition'
import type { CompositionRevisionId, CreativeAssetId, CreativeDocumentId } from '../domain/ids'
import {
  openCreativeStudioDatabase,
  type CreativeAssetBytesRecord,
  type CreativeStudioDatabaseSchema,
  type CreativeWorkingState,
} from './schema'
import type { CreativeProjectBundle, RestoredCreativeDocument } from './types'

const documentStores = [
  'projects',
  'briefs',
  'documents',
  'compositions',
  'composition-revisions',
  'assets',
  'references',
  'directions',
  'brand-profiles',
] as const

export class CompositionRevisionConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CompositionRevisionConflictError'
  }
}

function revisionsAreEqual(left: CompositionRevision, right: CompositionRevision): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

async function addImmutableRevision<
  TransactionStores extends ArrayLike<StoreNames<CreativeStudioDatabaseSchema>>,
>(
  revisions: IDBPObjectStore<
    CreativeStudioDatabaseSchema,
    TransactionStores,
    'composition-revisions',
    'readwrite'
  >,
  revision: CompositionRevision,
): Promise<void> {
  const existing = await revisions.get(revision.id)
  if (existing) {
    if (revisionsAreEqual(existing, revision)) return
    throw new CompositionRevisionConflictError(
      `Revision "${revision.id}" already exists and cannot be overwritten.`,
    )
  }

  const siblings = await revisions.index('by-composition').getAll(revision.compositionId)
  if (siblings.some((sibling) => sibling.revisionNumber === revision.revisionNumber)) {
    throw new CompositionRevisionConflictError(
      `Revision number ${revision.revisionNumber} already exists for composition "${revision.compositionId}".`,
    )
  }

  if (revision.parentRevisionId) {
    const parent = await revisions.get(revision.parentRevisionId)
    if (!parent || parent.compositionId !== revision.compositionId) {
      throw new CompositionRevisionConflictError(
        `Revision "${revision.id}" must reference a parent from the same composition.`,
      )
    }
  }

  await revisions.add(revision)
}

function assertBundleConsistency(bundle: CreativeProjectBundle): void {
  const { project, brief, document, composition, currentRevision } = bundle
  if (
    brief.projectId !== project.id ||
    document.projectId !== project.id ||
    composition.projectId !== project.id ||
    document.briefId !== brief.id ||
    document.compositionId !== composition.id ||
    document.currentRevisionId !== currentRevision.id ||
    composition.currentRevisionId !== currentRevision.id ||
    currentRevision.compositionId !== composition.id
  ) {
    throw new Error('Creative project bundle contains inconsistent entity references.')
  }
}

/**
 * Isolated persistence facade for Creative Studio. It never opens or writes the legacy Tweet Card DB.
 */
export class CreativeStudioRepository {
  constructor(
    private readonly database = openCreativeStudioDatabase(),
  ) {}

  async saveProjectBundle(bundle: CreativeProjectBundle): Promise<void> {
    assertBundleConsistency(bundle)
    const db = await this.database
    const transaction = db.transaction(documentStores, 'readwrite')

    await transaction.objectStore('projects').put(bundle.project)
    await transaction.objectStore('briefs').put(bundle.brief)
    await transaction.objectStore('documents').put(bundle.document)
    await transaction.objectStore('compositions').put(bundle.composition)

    const revisions = transaction.objectStore('composition-revisions')
    await addImmutableRevision(revisions, bundle.currentRevision)

    if (bundle.brandProfile) {
      await transaction.objectStore('brand-profiles').put(bundle.brandProfile)
    }
    for (const asset of bundle.assets ?? []) {
      await transaction.objectStore('assets').put(asset)
    }
    for (const reference of bundle.references ?? []) {
      await transaction.objectStore('references').put(reference)
    }
    for (const direction of bundle.directions ?? []) {
      await transaction.objectStore('directions').put(direction)
    }

    await transaction.done
  }

  async saveCompositionRevision(revision: CompositionRevision): Promise<void> {
    const db = await this.database
    const transaction = db.transaction('composition-revisions', 'readwrite')
    await addImmutableRevision(transaction.store, revision)
    await transaction.done
  }

  async saveComposition(composition: Composition): Promise<void> {
    const db = await this.database
    const revision = await db.get('composition-revisions', composition.currentRevisionId)
    if (!revision || revision.compositionId !== composition.id) {
      throw new CompositionRevisionConflictError(
        `Composition "${composition.id}" must point to an existing revision from the same composition.`,
      )
    }
    await db.put('compositions', composition)
  }

  async saveAsset(asset: CreativeAsset, bytes?: Blob): Promise<void> {
    const db = await this.database
    if (!bytes) {
      await db.put('assets', asset)
      return
    }

    const transaction = db.transaction(['assets', 'asset-bytes'], 'readwrite')
    await transaction.objectStore('assets').put(asset)
    await transaction.objectStore('asset-bytes').put({
      assetId: asset.id,
      bytes,
      updatedAt: asset.createdAt,
    })
    await transaction.done
  }

  async saveAssetBytes(record: CreativeAssetBytesRecord): Promise<void> {
    const db = await this.database
    await db.put('asset-bytes', record)
  }

  async getAsset(assetId: CreativeAssetId): Promise<CreativeAsset | undefined> {
    return (await this.database).get('assets', assetId)
  }

  async getAssetBytes(assetId: CreativeAssetId): Promise<Blob | undefined> {
    return (await this.database).get('asset-bytes', assetId).then((record) => record?.bytes)
  }

  async saveWorkingState(workingState: CreativeWorkingState): Promise<void> {
    const db = await this.database
    await db.put('working-states', workingState)
  }

  async getWorkingState(documentId: CreativeDocumentId): Promise<CreativeWorkingState | undefined> {
    return (await this.database).get('working-states', documentId)
  }

  async restoreDocument(documentId: CreativeDocumentId): Promise<RestoredCreativeDocument | undefined> {
    const db = await this.database
    const document = await db.get('documents', documentId)
    if (!document) return undefined

    const [project, brief, composition, currentRevision, workingState, brandProfile, references] =
      await Promise.all([
        db.get('projects', document.projectId),
        db.get('briefs', document.briefId),
        db.get('compositions', document.compositionId),
        db.get('composition-revisions', document.currentRevisionId),
        db.get('working-states', document.id),
        document.brandProfileId
          ? db.get('brand-profiles', document.brandProfileId)
          : Promise.resolve(undefined),
        Promise.all(document.referenceIds.map((referenceId) => db.get('references', referenceId))),
      ])

    if (
      !project ||
      !brief ||
      !composition ||
      !currentRevision ||
      currentRevision.compositionId !== composition.id
    ) {
      return undefined
    }

    const assetRecords = await Promise.all(
      document.assetIds.map((assetId) => db.get('assets', assetId)),
    )
    const assets = assetRecords.filter((asset): asset is CreativeAsset => Boolean(asset))
    const missingAssetIds = document.assetIds.filter((_, index) => !assetRecords[index])
    const selectedDirection = document.selectedDirectionId
      ? await db.get('directions', document.selectedDirectionId)
      : undefined

    return {
      project,
      brief,
      document,
      composition,
      currentRevision,
      ...(workingState ? { workingState } : {}),
      ...(brandProfile ? { brandProfile } : {}),
      assets,
      missingAssetIds,
      references: references.filter((reference): reference is NonNullable<typeof reference> =>
        Boolean(reference),
      ),
      ...(selectedDirection ? { selectedDirection } : {}),
    }
  }
}

export type { CreativeDocument, CompositionRevisionId }
