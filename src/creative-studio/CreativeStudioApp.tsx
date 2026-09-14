import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CreativeAsset } from './domain/creativeAsset'
import type { Composition, CompositionRevision } from './domain/composition'
import type { CreativeBrief } from './domain/creativeBrief'
import type { CreativeDocument } from './domain/creativeDocument'
import type { CreativeProject } from './domain/creativeProject'
import type {
  BrandProfileId,
  CompositionId,
  CompositionRevisionId,
  CreativeAssetId,
  CreativeBriefId,
  CreativeDocumentId,
  CreativeProjectId,
} from './domain/ids'
import { createInestBrandProfile } from './domain/inestBrandPreset'
import type { BrandProfile } from './domain/brandProfile'
import type { ElementLock } from './domain/locks'
import type { CompositionElement } from './domain/sceneGraph'
import { CreativeStudioEditor } from './editor'
import { OpenAICreativeEngineProvider } from './engine'
import {
  exportAndSaveCreativePagesZip,
  exportAndSaveCreativeRevision,
  type CreativeExportPage,
} from './export'
import { CreativeFlow } from './flow'
import {
  CreativeStudioAutosave,
  CreativeStudioRepository,
  type CreativeProjectBundle,
  type RestoredCreativeDocument,
} from './persistence'
import './creativeStudioApp.css'

const GATEWAY_URL = 'https://inest-creative-ai-gateway.onrender.com'
const PROJECT_ID = 'creative-project-p13' as CreativeProjectId
const BRIEF_ID = 'creative-brief-p13' as CreativeBriefId
const DOCUMENT_ID = 'creative-document-p13' as CreativeDocumentId
const COMPOSITION_ID = 'creative-composition-p13' as CompositionId
const INITIAL_REVISION_ID = 'creative-revision-p13-initial' as CompositionRevisionId
const BRAND_PROFILE_ID = 'creative-brand-inest' as BrandProfileId
const BRAND_LOGO_ASSET_ID = 'creative-asset-inest-logo' as CreativeAssetId

type CapturedPage = {
  canvas: Composition['canvas']
  revision: CompositionRevision
}

type Workspace = {
  project: CreativeProject
  brief: CreativeBrief
  document: CreativeDocument
  composition: Composition
  revision: CompositionRevision
  brandProfile: BrandProfile
  assets: CreativeAsset[]
  directions: Awaited<ReturnType<CreativeStudioRepository['getDirections']>>
  locks: ElementLock[]
  pages: CapturedPage[]
}

function createInitialBundle(): CreativeProjectBundle {
  const now = Date.now()
  const canvas = { format: 'feed-4-5', width: 1080, height: 1350, background: '#F5F7FA' } as const
  const brandProfile = createInestBrandProfile({
    id: BRAND_PROFILE_ID,
    primaryLogoAssetId: BRAND_LOGO_ASSET_ID,
    createdAt: now,
    updatedAt: now,
  })
  const logoAsset: CreativeAsset = {
    id: BRAND_LOGO_ASSET_ID,
    kind: 'logo',
    source: 'bundled',
    storageRef: '/assets/logo-inest-principal.png',
    mimeType: 'image/png',
    width: 1024,
    height: 1024,
    createdAt: now,
    metadata: { originalFileName: 'logo-inest-principal.png', altText: 'iNest' },
  }
  const revision: CompositionRevision = {
    id: INITIAL_REVISION_ID,
    compositionId: COMPOSITION_ID,
    revisionNumber: 0,
    elements: [],
    createdAt: now,
    origin: 'initial',
    label: 'Creative Studio initial canvas',
  }
  const project: CreativeProject = {
    id: PROJECT_ID,
    name: 'iNest Creative Studio',
    createdAt: now,
    updatedAt: now,
    status: 'active',
    currentDocumentId: DOCUMENT_ID,
    brandProfileId: BRAND_PROFILE_ID,
    canvas,
  }
  const brief: CreativeBrief = {
    id: BRIEF_ID,
    projectId: PROJECT_ID,
    content: 'AirPods mais acessíveis agora têm cancelamento de ruído.',
    headline: 'AirPods mais acessíveis agora têm cancelamento de ruído',
    cta: 'Leia a legenda 👇🏼',
    objective: 'stop-scroll',
    style: 'native-ugc',
    ugcIntensity: { value: 0.65 },
    composition: 'photo-dominant',
    brandPresence: 'minimal',
    imagePolicy: {
      originalRequired: false,
      allowCrop: true,
      allowBackgroundRemoval: false,
      allowAiGeneration: true,
    },
    canvas,
    createdAt: now,
    updatedAt: now,
  }
  const composition: Composition = {
    id: COMPOSITION_ID,
    projectId: PROJECT_ID,
    canvas,
    currentRevisionId: revision.id,
    createdAt: now,
    updatedAt: now,
  }
  const document: CreativeDocument = {
    id: DOCUMENT_ID,
    projectId: PROJECT_ID,
    briefId: BRIEF_ID,
    compositionId: COMPOSITION_ID,
    currentRevisionId: revision.id,
    pages: [],
    brandProfileId: BRAND_PROFILE_ID,
    assetIds: [BRAND_LOGO_ASSET_ID],
    referenceIds: [],
    createdAt: now,
    updatedAt: now,
  }
  return {
    project,
    brief,
    document,
    composition,
    currentRevision: revision,
    brandProfile,
    assets: [logoAsset],
  }
}

function workspaceFromBundle(bundle: CreativeProjectBundle): Workspace {
  if (!bundle.brandProfile) throw new Error('Creative Studio requires the iNest BrandProfile.')
  return {
    project: bundle.project,
    brief: bundle.brief,
    document: bundle.document,
    composition: bundle.composition,
    revision: bundle.currentRevision,
    brandProfile: bundle.brandProfile,
    assets: bundle.assets ?? [],
    directions: bundle.directions ?? [],
    locks: bundle.locks ?? [],
    pages: bundle.document.pages?.flatMap((page) => page.revisionId === bundle.currentRevision.id
      ? [{ canvas: page.canvas, revision: bundle.currentRevision }]
      : []) ?? [],
  }
}

function workspaceFromRestore(
  restored: RestoredCreativeDocument,
  directions: Workspace['directions'],
): Workspace {
  if (!restored.brandProfile) throw new Error('Restored Creative Studio document has no BrandProfile.')
  const currentRevision = restored.workingState
    ? { ...restored.currentRevision, elements: restored.workingState.elements }
    : restored.currentRevision
  return {
    project: restored.project,
    brief: restored.brief,
    document: restored.document,
    composition: restored.composition,
    revision: currentRevision,
    brandProfile: restored.brandProfile,
    assets: restored.assets,
    directions,
    locks: restored.locks,
    pages: restored.pages.map((page) => page.revision.id === currentRevision.id
      ? { ...page, revision: currentRevision }
      : page),
  }
}

let workspacePromise: Promise<Workspace> | undefined

async function loadWorkspace(repository: CreativeStudioRepository): Promise<Workspace> {
  const restored = await repository.restoreDocument(DOCUMENT_ID)
  if (restored) {
    const directions = await repository.getDirections(restored.project.id)
    return workspaceFromRestore(restored, directions)
  }
  const bundle = createInitialBundle()
  await repository.saveProjectBundle(bundle)
  return workspaceFromBundle(bundle)
}

function visualAssetIds(elements: CompositionElement[]) {
  return elements.flatMap((element) =>
    element.type === 'image' ||
    element.type === 'photo' ||
    element.type === 'product' ||
    element.type === 'logo'
      ? [element.assetId]
      : [],
  )
}

export function CreativeStudioApp() {
  const repository = useMemo(() => new CreativeStudioRepository(), [])
  const autosave = useMemo(
    () => new CreativeStudioAutosave(repository, { onError: (error) => console.error(error) }),
    [repository],
  )
  const engine = useMemo(
    () => new OpenAICreativeEngineProvider({
      baseUrl: GATEWAY_URL,
      resolveAssetBytes: (assetId) => repository.getAssetBytes(assetId),
    }),
    [repository],
  )
  const objectUrls = useRef(new Map<CreativeAssetId, string>())
  const [workspace, setWorkspace] = useState<Workspace>()
  const [workingElements, setWorkingElements] = useState<CompositionElement[]>([])
  const [locks, setLocks] = useState<ElementLock[]>([])
  const [pages, setPages] = useState<CapturedPage[]>([])
  const [status, setStatus] = useState('Loading Creative Studio…')
  const [exporting, setExporting] = useState(false)

  const hydrateAssets = useCallback(async (elements: CompositionElement[], knownAssets: CreativeAsset[]) => {
    const ids = Array.from(new Set(visualAssetIds(elements)))
    const records = await Promise.all(ids.map(async (assetId) => {
      const known = knownAssets.find((asset) => asset.id === assetId)
      return known ?? repository.getAsset(assetId)
    }))
    const found = records.filter((asset): asset is CreativeAsset => Boolean(asset))
    setWorkspace((current) => current
      ? { ...current, assets: Array.from(new Map([...current.assets, ...found].map((asset) => [asset.id, asset])).values()) }
      : current)

    await Promise.all(found.map(async (asset) => {
      if (asset.source === 'bundled' || objectUrls.current.has(asset.id)) return
      const bytes = await repository.getAssetBytes(asset.id)
      if (bytes) objectUrls.current.set(asset.id, URL.createObjectURL(bytes))
    }))
  }, [repository])

  useEffect(() => {
    let active = true
    workspacePromise ??= loadWorkspace(repository)
    void workspacePromise.then(async (loaded) => {
      if (!active) return
      setWorkspace(loaded)
      setWorkingElements(loaded.revision.elements)
      setLocks(loaded.locks)
      setPages(loaded.pages)
      await hydrateAssets([
        ...loaded.revision.elements,
        ...loaded.pages.flatMap((page) => page.revision.elements),
      ], loaded.assets)
      if (active) setStatus('Creative Studio ready. Changes are saved locally.')
    }).catch((error: unknown) => {
      if (active) setStatus(error instanceof Error ? error.message : 'Creative Studio failed to load.')
    })
    return () => { active = false }
  }, [hydrateAssets, repository])

  useEffect(() => () => {
    autosave.cancel()
    for (const url of objectUrls.current.values()) URL.revokeObjectURL(url)
    objectUrls.current.clear()
  }, [autosave])

  const resolveAssetUrl = useCallback((assetId: CreativeAssetId) => {
    const objectUrl = objectUrls.current.get(assetId)
    if (objectUrl) return objectUrl
    const asset = workspace?.assets.find((item) => item.id === assetId)
    return asset?.source === 'bundled' ? asset.storageRef : undefined
  }, [workspace?.assets])

  const handleCompositionReady = useCallback(async (
    composition: Composition,
    revision: CompositionRevision,
    nextLocks: ElementLock[],
    document: CreativeDocument,
  ) => {
    setWorkspace((current) => current ? { ...current, composition, revision, document } : current)
    setWorkingElements(revision.elements)
    setLocks(nextLocks)
    setPages((current) => [
      ...current.filter((page) => page.revision.id !== revision.id),
      { canvas: composition.canvas, revision },
    ])
    await hydrateAssets(revision.elements, workspace?.assets ?? [])
    setStatus(`Revision ${revision.revisionNumber} ready and saved.`)
  }, [hydrateAssets, workspace?.assets])

  const handleLocksChange = useCallback((nextLocks: ElementLock[]) => {
    if (!workspace) return
    setLocks(nextLocks)
    void repository.replaceLocksForRevision(
      workspace.composition.id,
      workspace.revision.id,
      nextLocks.filter((lock) =>
        lock.compositionId === workspace.composition.id && lock.revisionId === workspace.revision.id),
    ).catch((error: unknown) => {
      console.error(error)
      setStatus(error instanceof Error ? error.message : 'Creative Studio locks failed to save.')
    })
  }, [repository, workspace])

  const handleWorkingElementsChange = useCallback((elements: CompositionElement[]) => {
    if (!workspace) return
    setWorkingElements(elements)
    autosave.schedule({
      documentId: workspace.document.id,
      projectId: workspace.project.id,
      compositionId: workspace.composition.id,
      baseRevisionId: workspace.revision.id,
      elements,
      updatedAt: Date.now(),
    })
    setPages((current) => current.map((page) => page.revision.id === workspace.revision.id
      ? { ...page, revision: { ...page.revision, elements } }
      : page))
  }, [autosave, workspace])

  const currentExportPage = useMemo<CreativeExportPage | undefined>(() => workspace ? {
    canvas: workspace.composition.canvas,
    revision: { ...workspace.revision, elements: workingElements },
    resolveAssetUrl,
    fileName: `inest-creative-${workspace.composition.canvas.format}.png`,
  } : undefined, [resolveAssetUrl, workspace, workingElements])

  const runExport = async (action: () => Promise<void>) => {
    setExporting(true)
    try {
      await autosave.flush()
      await action()
      setStatus('Export completed.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Creative Studio export failed.')
    } finally {
      setExporting(false)
    }
  }

  if (!workspace) {
    return <main className="creative-studio-app creative-studio-app--loading">{status}</main>
  }

  const editorRevision = { ...workspace.revision, elements: workingElements }
  const exportPages: CreativeExportPage[] = pages.map((page, index) => ({
    canvas: page.canvas,
    revision: page.revision,
    resolveAssetUrl,
    fileName: `inest-creative-page-${String(index + 1).padStart(2, '0')}.png`,
  }))

  return (
    <main className="creative-studio-app">
      <CreativeFlow
        project={workspace.project}
        document={workspace.document}
        brief={workspace.brief}
        brandProfile={workspace.brandProfile}
        composition={workspace.composition}
        currentRevision={workspace.revision}
        locks={locks}
        initialAssets={workspace.assets}
        initialDirections={workspace.directions}
        initialReferences={[]}
        persistence={repository}
        engineProvider={engine}
        onCompositionReady={handleCompositionReady}
      />

      {workspace.revision.elements.length > 0 ? (
        <section className="creative-studio-app__result" aria-label="Creative Studio result">
          <div className="creative-studio-app__result-header">
            <div>
              <span>Optional refinement</span>
              <h2>Editable composition</h2>
            </div>
            <div className="creative-studio-app__export-actions">
              <button
                type="button"
                disabled={exporting || !currentExportPage}
                onClick={() => currentExportPage && void runExport(() =>
                  exportAndSaveCreativeRevision(currentExportPage))}
              >
                Export PNG
              </button>
              <button
                type="button"
                disabled={exporting || exportPages.length < 2}
                onClick={() => void runExport(() =>
                  exportAndSaveCreativePagesZip(exportPages, 'inest-creative-pages.zip'))}
              >
                Export pages ZIP ({exportPages.length})
              </button>
            </div>
          </div>
          <CreativeStudioEditor
            key={workspace.revision.id}
            revision={editorRevision}
            canvas={workspace.composition.canvas}
            assets={workspace.assets}
            brandProfile={workspace.brandProfile}
            brandOverrides={workspace.document.brandOverrides}
            resolveAssetUrl={resolveAssetUrl}
            locks={locks}
            onLocksChange={handleLocksChange}
            onWorkingElementsChange={handleWorkingElementsChange}
            onInvariantViolation={() => setStatus('A locked property blocked that edit.')}
          />
        </section>
      ) : null}
      <p className="creative-studio-app__status" role="status">{status}</p>
    </main>
  )
}
