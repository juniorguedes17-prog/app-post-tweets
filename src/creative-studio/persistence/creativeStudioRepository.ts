import type { IDBPObjectStore, StoreNames } from 'idb'
import type { CreativeAsset } from '../domain/creativeAsset'
import type { CreativeBrief } from '../domain/creativeBrief'
import type { CreativeDirection } from '../domain/creativeDirection'
import type { CreativeDocument } from '../domain/creativeDocument'
import type { Composition, CompositionRevision } from '../domain/composition'
import type {
  CompositionId,
  CompositionRevisionId,
  CreativeAssetId,
  CreativeDocumentId,
  CreativeProjectId,
  VisualReferenceId,
} from '../domain/ids'
import type { VisualReference } from '../domain/visualReference'
import type { ElementLock } from '../domain/locks'
import {
  openCreativeStudioDatabase,
  type CreativeAssetBytesRecord,
  type CreativeStudioDatabaseSchema,
  type CreativeWorkingState,
} from './schema'
import type { CreativeProjectBundle, RestoredCreativeDocument } from './types'

export type GeneratedAssetRecord = {
  asset: CreativeAsset
  bytes: Blob
}

export type SaveCreativeEngineRevisionInput = {
  composition: Composition
  revision: CompositionRevision
  document: CreativeDocument
  generatedAssets?: GeneratedAssetRecord[]
  references?: VisualReference[]
  locks?: ElementLock[]
}

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
  'locks',
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

  await revisions.add(revision, revision.id)
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

    await transaction.objectStore('projects').put(bundle.project, bundle.project.id)
    await transaction.objectStore('briefs').put(bundle.brief, bundle.brief.id)
    await transaction.objectStore('documents').put(bundle.document, bundle.document.id)
    await transaction.objectStore('compositions').put(bundle.composition, bundle.composition.id)

    const revisions = transaction.objectStore('composition-revisions')
    await addImmutableRevision(revisions, bundle.currentRevision)

    if (bundle.brandProfile) {
      await transaction.objectStore('brand-profiles').put(bundle.brandProfile, bundle.brandProfile.id)
    }
    for (const asset of bundle.assets ?? []) {
      await transaction.objectStore('assets').put(asset, asset.id)
    }
    for (const reference of bundle.references ?? []) {
      await transaction.objectStore('references').put(reference, reference.id)
    }
    for (const direction of bundle.directions ?? []) {
      await transaction.objectStore('directions').put(direction, direction.id)
    }
    for (const lock of bundle.locks ?? []) {
      await transaction.objectStore('locks').put(lock, lock.id)
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
    await db.put('compositions', composition, composition.id)
  }

  async saveAsset(asset: CreativeAsset, bytes?: Blob): Promise<void> {
    const db = await this.database
    if (!bytes) {
      await db.put('assets', asset, asset.id)
      return
    }

    const transaction = db.transaction(['assets', 'asset-bytes'], 'readwrite')
    await transaction.objectStore('assets').put(asset, asset.id)
    await transaction.objectStore('asset-bytes').put({
      assetId: asset.id,
      bytes,
      updatedAt: asset.createdAt,
    }, asset.id)
    await transaction.done
  }

  async saveAssetForDocument(
    asset: CreativeAsset,
    bytes: Blob,
    document: CreativeDocument,
  ): Promise<void> {
    if (!document.assetIds.includes(asset.id)) {
      throw new Error(`Document "${document.id}" must reference asset "${asset.id}".`)
    }
    const db = await this.database
    const transaction = db.transaction(['assets', 'asset-bytes', 'documents'], 'readwrite')
    await transaction.objectStore('assets').put(asset, asset.id)
    await transaction.objectStore('asset-bytes').put({
      assetId: asset.id,
      bytes,
      updatedAt: asset.createdAt,
    }, asset.id)
    await transaction.objectStore('documents').put(document, document.id)
    await transaction.done
  }

  async removeAssetFromDocument(
    assetId: CreativeAssetId,
    document: CreativeDocument,
  ): Promise<void> {
    if (document.assetIds.includes(assetId)) {
      throw new Error(`Document "${document.id}" must detach asset "${assetId}" before removal.`)
    }
    const db = await this.database
    const transaction = db.transaction(['assets', 'asset-bytes', 'documents'], 'readwrite')
    await transaction.objectStore('assets').delete(assetId)
    await transaction.objectStore('asset-bytes').delete(assetId)
    await transaction.objectStore('documents').put(document, document.id)
    await transaction.done
  }

  async saveReferenceForDocument(
    reference: VisualReference,
    asset: CreativeAsset,
    bytes: Blob,
    document: CreativeDocument,
  ): Promise<void> {
    if (reference.assetId !== asset.id || asset.kind !== 'reference') {
      throw new Error('Visual reference and reference asset are inconsistent.')
    }
    if (!document.assetIds.includes(asset.id) || !document.referenceIds.includes(reference.id)) {
      throw new Error(`Document "${document.id}" must reference the visual reference and its asset.`)
    }
    const db = await this.database
    const transaction = db.transaction(
      ['assets', 'asset-bytes', 'references', 'documents'],
      'readwrite',
    )
    await transaction.objectStore('assets').put(asset, asset.id)
    await transaction.objectStore('asset-bytes').put({
      assetId: asset.id,
      bytes,
      updatedAt: asset.createdAt,
    }, asset.id)
    await transaction.objectStore('references').put(reference, reference.id)
    await transaction.objectStore('documents').put(document, document.id)
    await transaction.done
  }

  async removeReferenceFromDocument(
    referenceId: VisualReferenceId,
    assetId: CreativeAssetId,
    document: CreativeDocument,
  ): Promise<void> {
    if (document.referenceIds.includes(referenceId) || document.assetIds.includes(assetId)) {
      throw new Error(
        `Document "${document.id}" must detach reference "${referenceId}" and its asset before removal.`,
      )
    }
    const db = await this.database
    const transaction = db.transaction(
      ['assets', 'asset-bytes', 'references', 'documents'],
      'readwrite',
    )
    await transaction.objectStore('references').delete(referenceId)
    await transaction.objectStore('assets').delete(assetId)
    await transaction.objectStore('asset-bytes').delete(assetId)
    await transaction.objectStore('documents').put(document, document.id)
    await transaction.done
  }

  async saveCreativeFlow(
    brief: CreativeBrief,
    document: CreativeDocument,
    directions: CreativeDirection[],
    references: VisualReference[] = [],
  ): Promise<void> {
    if (directions.length !== 3) {
      throw new Error('P9 creative flow must persist exactly three directions.')
    }
    if (
      brief.projectId !== document.projectId ||
      directions.some((direction) => direction.projectId !== document.projectId)
    ) {
      throw new Error('Creative flow contains inconsistent project references.')
    }
    const db = await this.database
    const transaction = db.transaction(
      ['briefs', 'documents', 'directions', 'references'],
      'readwrite',
    )
    const directionStore = transaction.objectStore('directions')
    const existingDirections = await directionStore.index('by-project').getAll(document.projectId)
    for (const direction of existingDirections) await directionStore.delete(direction.id)
    for (const direction of directions) await directionStore.put(direction, direction.id)
    await transaction.objectStore('briefs').put(brief, brief.id)
    await transaction.objectStore('documents').put(document, document.id)
    for (const reference of references) {
      await transaction.objectStore('references').put(reference, reference.id)
    }
    await transaction.done
  }

  async saveDocument(document: CreativeDocument): Promise<void> {
    const db = await this.database
    await db.put('documents', document, document.id)
  }

  async getDirections(projectId: CreativeProjectId): Promise<CreativeDirection[]> {
    const db = await this.database
    return db.getAllFromIndex('directions', 'by-project', projectId)
  }

  async saveCreativeEngineRevision({
    composition,
    revision,
    document,
    generatedAssets = [],
    references = [],
    locks = [],
  }: SaveCreativeEngineRevisionInput): Promise<void> {
    if (
      revision.compositionId !== composition.id ||
      composition.currentRevisionId !== revision.id ||
      document.compositionId !== composition.id ||
      document.currentRevisionId !== revision.id ||
      generatedAssets.some(({ asset }) => !document.assetIds.includes(asset.id))
    ) {
      throw new Error('Creative Engine result contains inconsistent entity references.')
    }
    const db = await this.database
    const transaction = db.transaction(
      ['composition-revisions', 'compositions', 'documents', 'assets', 'asset-bytes', 'references', 'locks'],
      'readwrite',
    )
    await addImmutableRevision(transaction.objectStore('composition-revisions'), revision)
    await transaction.objectStore('compositions').put(composition, composition.id)
    await transaction.objectStore('documents').put(document, document.id)
    for (const { asset, bytes } of generatedAssets) {
      await transaction.objectStore('assets').put(asset, asset.id)
      await transaction.objectStore('asset-bytes').put({
        assetId: asset.id,
        bytes,
        updatedAt: asset.createdAt,
      }, asset.id)
    }
    for (const reference of references) {
      await transaction.objectStore('references').put(reference, reference.id)
    }
    for (const lock of locks) {
      if (lock.compositionId !== composition.id || lock.revisionId !== revision.id) {
        throw new Error('Persisted locks must belong to the accepted revision.')
      }
      await transaction.objectStore('locks').put(lock, lock.id)
    }
    await transaction.done
  }

  async replaceLocksForRevision(
    compositionId: CompositionId,
    revisionId: CompositionRevisionId,
    locks: ElementLock[],
  ): Promise<void> {
    if (locks.some((lock) => lock.compositionId !== compositionId || lock.revisionId !== revisionId)) {
      throw new Error('Locks must belong to the revision they replace.')
    }
    const db = await this.database
    const transaction = db.transaction('locks', 'readwrite')
    const store = transaction.store
    const existing = await store.index('by-revision').getAll(revisionId)
    for (const lock of existing) await store.delete(lock.id)
    for (const lock of locks) await store.put(lock, lock.id)
    await transaction.done
  }

  async getLocksForRevision(revisionId: CompositionRevisionId): Promise<ElementLock[]> {
    const db = await this.database
    return db.getAllFromIndex('locks', 'by-revision', revisionId)
  }

  async saveAssetBytes(record: CreativeAssetBytesRecord): Promise<void> {
    const db = await this.database
    await db.put('asset-bytes', record, record.assetId)
  }

  async getAsset(assetId: CreativeAssetId): Promise<CreativeAsset | undefined> {
    return (await this.database).get('assets', assetId)
  }

  async getAssetBytes(assetId: CreativeAssetId): Promise<Blob | undefined> {
    return (await this.database).get('asset-bytes', assetId).then((record) => record?.bytes)
  }

  async saveWorkingState(workingState: CreativeWorkingState): Promise<void> {
    const db = await this.database
    await db.put('working-states', workingState, workingState.documentId)
  }

  async getWorkingState(documentId: CreativeDocumentId): Promise<CreativeWorkingState | undefined> {
    return (await this.database).get('working-states', documentId)
  }

  async restoreDocument(documentId: CreativeDocumentId): Promise<RestoredCreativeDocument | undefined> {
    const db = await this.database
    const document = await db.get('documents', documentId)
    if (!document) return undefined

    const [project, brief, composition, currentRevision, workingState, brandProfile, references, locks] =
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
        db.getAllFromIndex('locks', 'by-revision', document.currentRevisionId),
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
      locks,
    }
  }
}

export type { CreativeDocument, CompositionRevisionId }
