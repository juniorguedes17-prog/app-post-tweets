import { useMemo, useState, type ChangeEvent, type CSSProperties } from 'react'
import type { BrandOverrides, BrandProfile, BrandTypographyOverrides } from '../domain/brandProfile'
import type { CanvasFormat, CanvasSpec } from '../domain/canvas'
import type { CreativeAsset, CreativeAssetKind } from '../domain/creativeAsset'
import type {
  BrandPresence,
  CompositionStrategy,
  CreativeBrief,
  CreativeObjective,
  CreativeStyle,
} from '../domain/creativeBrief'
import type { CreativeDirection } from '../domain/creativeDirection'
import type { CreativeDocument } from '../domain/creativeDocument'
import type { CreativeEngineInput, CreativeEngineProvider } from '../domain/creativeEngine'
import type { Composition, CompositionRevision } from '../domain/composition'
import type { CreativeAssetId, VisualReferenceId } from '../domain/ids'
import type { ElementLock } from '../domain/locks'
import type { CreativeProject } from '../domain/creativeProject'
import type { TypographyDefinition } from '../domain/typography'
import type { VisualReference } from '../domain/visualReference'
import { resolveEditorPalette, resolveEditorTypography } from '../editor/brandContext'
import {
  OpenAICreativeEngineProvider,
  REFINEMENT_INTENT_LABELS,
  type GeneratedAssetOutput,
  type RefinementIntent,
} from '../engine'
import { CreativeStudioRepository } from '../persistence/creativeStudioRepository'
import {
  attachAsset,
  attachReference,
  createUploadedImageAsset,
  createVisualReference,
  detachAsset,
  detachReference,
  selectCreativeDirection,
} from './flowState'
import './creativeFlow.css'

export type CreativeFlowPersistence = Pick<
  CreativeStudioRepository,
  | 'saveAssetForDocument'
  | 'removeAssetFromDocument'
  | 'saveReferenceForDocument'
  | 'removeReferenceFromDocument'
  | 'saveCreativeFlow'
  | 'saveDocument'
  | 'getAssetBytes'
  | 'saveCreativeEngineRevision'
>

export type CreativeFlowIdFactory = {
  assetId: () => CreativeAssetId
  referenceId: () => VisualReferenceId
}

export type CreativeFlowProps = {
  project: CreativeProject
  document: CreativeDocument
  brief: CreativeBrief
  brandProfile: BrandProfile
  composition: Composition
  currentRevision: CompositionRevision
  locks?: ElementLock[]
  initialAssets?: CreativeAsset[]
  initialReferences?: VisualReference[]
  initialDirections?: CreativeDirection[]
  persistence?: CreativeFlowPersistence
  engineProvider?: CreativeEngineProvider
  idFactory?: CreativeFlowIdFactory
  onSelectedDirectionChange?: (direction?: CreativeDirection) => void
  onCompositionReady?: (composition: Composition, revision: CompositionRevision) => void
}

type CreativeEngineRuntime = CreativeEngineProvider & {
  drainGeneratedAssets?: () => GeneratedAssetOutput[]
  drainReferenceAnalyses?: () => Map<string, VisualReference['analysis']>
}

let fallbackIdSequence = 0

function generatedId(prefix: string): string {
  fallbackIdSequence += 1
  return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${fallbackIdSequence}`}`
}

const defaultIdFactory: CreativeFlowIdFactory = {
  assetId: () => generatedId('asset') as CreativeAssetId,
  referenceId: () => generatedId('reference') as VisualReferenceId,
}

const canvasPresets: Record<Exclude<CanvasFormat, 'custom'>, Omit<CanvasSpec, 'background'>> = {
  'feed-4-5': { format: 'feed-4-5', width: 1080, height: 1350 },
  'story-9-16': { format: 'story-9-16', width: 1080, height: 1920 },
  'square-1-1': { format: 'square-1-1', width: 1080, height: 1080 },
  'tweet-card': { format: 'tweet-card', width: 1080, height: 1350 },
}

const objectives: CreativeObjective[] = [
  'stop-scroll', 'comments', 'shares', 'authority', 'conversion', 'desire',
]
const styles: CreativeStyle[] = [
  'native-ugc', 'tweet', 'editorial', 'product', 'lifestyle', 'storytelling',
]
const compositions: CompositionStrategy[] = [
  'auto', 'centered', 'asymmetric', 'photo-dominant', 'typography-dominant',
]
const brandPresences: BrandPresence[] = ['minimal', 'normal', 'none']
const assetKinds: Exclude<CreativeAssetKind, 'reference'>[] = ['image', 'photo', 'product', 'logo']

function canvasForFormat(format: CanvasFormat, current: CanvasSpec): CanvasSpec {
  if (format === 'custom') return { ...current, format }
  return { ...canvasPresets[format], background: current.background }
}

async function imageDimensions(file: File): Promise<{ width: number; height: number }> {
  if ('createImageBitmap' in globalThis) {
    const bitmap = await createImageBitmap(file)
    const dimensions = { width: bitmap.width, height: bitmap.height }
    bitmap.close()
    return dimensions
  }
  const objectUrl = URL.createObjectURL(file)
  try {
    return await new Promise((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight })
      image.onerror = () => reject(new Error('Unable to read image dimensions.'))
      image.src = objectUrl
    })
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

export function CreativeFlow({
  project,
  document,
  brief,
  brandProfile,
  composition,
  currentRevision,
  locks = [],
  initialAssets = [],
  initialReferences = [],
  initialDirections = [],
  persistence,
  engineProvider,
  idFactory = defaultIdFactory,
  onSelectedDirectionChange,
  onCompositionReady,
}: CreativeFlowProps) {
  const repository = useMemo<CreativeFlowPersistence>(
    () => persistence ?? new CreativeStudioRepository(),
    [persistence],
  )
  const engine = useMemo<CreativeEngineRuntime>(
    () => engineProvider ?? new OpenAICreativeEngineProvider({
      resolveAssetBytes: (assetId) => repository.getAssetBytes(assetId),
    }),
    [engineProvider, repository],
  )
  const [draftBrief, setDraftBrief] = useState(brief)
  const [activeDocument, setActiveDocument] = useState(document)
  const [assets, setAssets] = useState(initialAssets)
  const [references, setReferences] = useState(initialReferences)
  const [directions, setDirections] = useState(initialDirections.length === 3 ? initialDirections : [])
  const [activeComposition, setActiveComposition] = useState(composition)
  const [activeRevision, setActiveRevision] = useState(currentRevision)
  const [brandOverrides, setBrandOverrides] = useState<BrandOverrides>(document.brandOverrides ?? {})
  const [assetKind, setAssetKind] = useState<Exclude<CreativeAssetKind, 'reference'>>('photo')
  const [referencePurpose, setReferencePurpose] = useState('')
  const [customColorName, setCustomColorName] = useState('')
  const [customColorValue, setCustomColorValue] = useState('#5F7CFF')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string>()
  const [error, setError] = useState<string>()

  const palette = resolveEditorPalette(brandProfile, brandOverrides) ?? brandProfile.palette
  const typography = resolveEditorTypography(brandProfile, brandOverrides) ?? brandProfile.typography
  const selectedDirection = directions.find(
    (direction) => direction.id === activeDocument.selectedDirectionId,
  )

  const updateBrief = (patch: Partial<CreativeBrief>) => {
    setDraftBrief((current) => ({ ...current, ...patch, updatedAt: Date.now() }))
    setMessage(undefined)
  }

  const updatePalette = (key: keyof Omit<typeof palette, 'custom'>, value: string) => {
    setBrandOverrides((current) => ({
      ...current,
      palette: { ...current.palette, [key]: value },
    }))
  }

  const updateTypography = (
    role: keyof Omit<BrandTypographyOverrides, 'allowedFonts'>,
    patch: Partial<TypographyDefinition>,
  ) => {
    setBrandOverrides((current) => ({
      ...current,
      typography: {
        ...current.typography,
        [role]: { ...current.typography?.[role], ...patch },
      },
    }))
  }

  const addCustomColor = () => {
    const name = customColorName.trim()
    if (!name) return
    setBrandOverrides((current) => ({
      ...current,
      palette: {
        ...current.palette,
        custom: { ...current.palette?.custom, [name]: customColorValue },
      },
    }))
    setCustomColorName('')
  }

  const updateCustomColor = (name: string, value: string) => {
    setBrandOverrides((current) => ({
      ...current,
      palette: {
        ...current.palette,
        custom: { ...current.palette?.custom, [name]: value },
      },
    }))
  }

  const runAction = async (action: () => Promise<void>) => {
    setBusy(true)
    setError(undefined)
    try {
      await action()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Creative Studio operation failed.')
    } finally {
      setBusy(false)
    }
  }

  const addAsset = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return
    void runAction(async () => {
      const dimensions = await imageDimensions(file)
      const now = Date.now()
      const asset = createUploadedImageAsset({
        id: idFactory.assetId(), kind: assetKind, fileName: file.name,
        mimeType: file.type || 'application/octet-stream', ...dimensions,
        byteSize: file.size, createdAt: now,
      })
      const nextDocument = attachAsset(activeDocument, asset.id, now)
      await repository.saveAssetForDocument(asset, file, nextDocument)
      setAssets((current) => [...current, asset])
      setActiveDocument(nextDocument)
      setMessage('Asset saved locally.')
    })
  }

  const removeAsset = (asset: CreativeAsset) => {
    void runAction(async () => {
      const nextDocument = detachAsset(activeDocument, asset.id, Date.now())
      await repository.removeAssetFromDocument(asset.id, nextDocument)
      setAssets((current) => current.filter((item) => item.id !== asset.id))
      setActiveDocument(nextDocument)
      setMessage('Asset removed.')
    })
  }

  const addReference = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return
    void runAction(async () => {
      const dimensions = await imageDimensions(file)
      const now = Date.now()
      const asset = createUploadedImageAsset({
        id: idFactory.assetId(), kind: 'reference', fileName: file.name,
        mimeType: file.type || 'application/octet-stream', ...dimensions,
        byteSize: file.size, createdAt: now,
      })
      const reference = createVisualReference({
        id: idFactory.referenceId(), assetId: asset.id,
        purpose: referencePurpose, createdAt: now,
      })
      const nextDocument = attachReference(activeDocument, reference, now)
      await repository.saveReferenceForDocument(reference, asset, file, nextDocument)
      setAssets((current) => [...current, asset])
      setReferences((current) => [...current, reference])
      setActiveDocument(nextDocument)
      setReferencePurpose('')
      setMessage('Visual reference saved as structured input.')
    })
  }

  const removeReference = (reference: VisualReference) => {
    void runAction(async () => {
      const nextDocument = detachReference(activeDocument, reference, Date.now())
      await repository.removeReferenceFromDocument(reference.id, reference.assetId, nextDocument)
      setReferences((current) => current.filter((item) => item.id !== reference.id))
      setAssets((current) => current.filter((asset) => asset.id !== reference.assetId))
      setActiveDocument(nextDocument)
      setMessage('Visual reference removed.')
    })
  }

  const engineInput = (
    nextBrief: CreativeBrief,
    direction?: CreativeDirection,
    refinementIntent?: RefinementIntent,
  ): CreativeEngineInput => ({
    brief: nextBrief,
    canvas: nextBrief.canvas,
    brandProfile,
    brandOverrides,
    assets,
    references,
    referenceAnalyses: references.flatMap((reference) => (
      reference.analysis ? [reference.analysis] : []
    )),
    direction,
    previousRevision: activeRevision,
    locks,
    refinementIntent,
  })

  const consumeReferenceAnalyses = (): VisualReference[] => {
    const analyses = engine.drainReferenceAnalyses?.()
    if (!analyses?.size) return references
    return references.map((reference) => {
      const analysis = analyses.get(reference.id)
      return analysis ? { ...reference, analysis, updatedAt: Date.now() } : reference
    })
  }

  const persistEngineRevision = async (
    revision: CompositionRevision,
    direction: CreativeDirection,
    selectedDocument: CreativeDocument,
  ) => {
    const generatedAssets = engine.drainGeneratedAssets?.() ?? []
    const nextReferences = consumeReferenceAnalyses()
    const nextComposition: Composition = {
      ...activeComposition,
      canvas: draftBrief.canvas,
      sourceDirectionId: direction.id,
      currentRevisionId: revision.id,
      updatedAt: revision.createdAt,
    }
    const nextDocument: CreativeDocument = {
      ...selectedDocument,
      currentRevisionId: revision.id,
      brandOverrides,
      assetIds: Array.from(new Set([
        ...selectedDocument.assetIds,
        ...generatedAssets.map(({ asset }) => asset.id),
      ])),
      updatedAt: revision.createdAt,
    }
    await repository.saveCreativeEngineRevision({
      composition: nextComposition,
      revision,
      document: nextDocument,
      generatedAssets,
      references: nextReferences,
    })
    setActiveComposition(nextComposition)
    setActiveRevision(revision)
    setActiveDocument(nextDocument)
    setReferences(nextReferences)
    if (generatedAssets.length) {
      setAssets((current) => [...current, ...generatedAssets.map(({ asset }) => asset)])
    }
    onCompositionReady?.(nextComposition, revision)
  }

  const generateDirections = () => {
    void runAction(async () => {
      const now = Date.now()
      const nextBrief = { ...draftBrief, updatedAt: now }
      const result = await engine.proposeDirections(engineInput(nextBrief))
      const nextDirections = result.output
      if (nextDirections.length !== 3) throw new Error('Creative Engine must return three directions.')
      const nextReferences = consumeReferenceAnalyses()
      const nextDocument = {
        ...selectCreativeDirection(activeDocument, undefined, now),
        brandOverrides,
      }
      await repository.saveCreativeFlow(nextBrief, nextDocument, nextDirections, nextReferences)
      setDraftBrief(nextBrief)
      setActiveDocument(nextDocument)
      setDirections(nextDirections)
      setReferences(nextReferences)
      onSelectedDirectionChange?.(undefined)
      setMessage('Three Creative Engine directions generated and saved.')
    })
  }

  const chooseDirection = (direction: CreativeDirection) => {
    void runAction(async () => {
      const nextDocument = selectCreativeDirection(activeDocument, direction.id, Date.now())
      await repository.saveDocument(nextDocument)
      setActiveDocument(nextDocument)
      onSelectedDirectionChange?.(direction)
      const result = await engine.compose(engineInput(draftBrief, direction))
      await persistEngineRevision(result.output, direction, nextDocument)
      setMessage(`${direction.name} selected and composed as revision ${result.output.revisionNumber}.`)
    })
  }

  const refineComposition = (intent: RefinementIntent) => {
    if (!selectedDirection) return
    void runAction(async () => {
      const result = await engine.refine(engineInput(draftBrief, selectedDirection, intent))
      await persistEngineRevision(result.output, selectedDirection, activeDocument)
      setMessage(`${REFINEMENT_INTENT_LABELS[intent]} created revision ${result.output.revisionNumber}.`)
    })
  }

  const previewStyle = {
    '--creative-studio-flow-primary': palette.primary,
    '--creative-studio-flow-secondary': palette.secondary,
    '--creative-studio-flow-accent': palette.accent,
    '--creative-studio-flow-background': palette.background,
    '--creative-studio-flow-text': palette.text,
  } as CSSProperties

  return (
    <section className="creative-studio-flow" style={previewStyle} aria-label="Creative direction flow">
      <header className="creative-studio-flow__header">
        <div><span>Creative Studio</span><h1>Brief → Directions</h1></div>
        <p>{project.name}</p>
      </header>

      <div className="creative-studio-flow__layout">
        <form
          className="creative-studio-flow__form"
          onSubmit={(event) => { event.preventDefault(); generateDirections() }}
        >
          <fieldset className="creative-studio-flow__section" disabled={busy}>
            <legend>Brief</legend>
            <label className="creative-studio-flow__field creative-studio-flow__field--wide">
              <span>Content</span>
              <textarea
                rows={4}
                value={draftBrief.content}
                onChange={(event) => updateBrief({ content: event.currentTarget.value })}
              />
            </label>
            <label className="creative-studio-flow__field creative-studio-flow__field--wide">
              <span>Headline</span>
              <input
                value={draftBrief.headline}
                onChange={(event) => updateBrief({ headline: event.currentTarget.value })}
              />
            </label>
            <label className="creative-studio-flow__field creative-studio-flow__field--wide">
              <span>Supporting text</span>
              <textarea
                rows={3}
                value={draftBrief.body ?? ''}
                onChange={(event) => updateBrief({ body: event.currentTarget.value })}
              />
            </label>
            <label className="creative-studio-flow__field">
              <span>CTA</span>
              <input
                value={draftBrief.cta ?? ''}
                onChange={(event) => updateBrief({ cta: event.currentTarget.value })}
              />
            </label>
            <label className="creative-studio-flow__field">
              <span>Objective</span>
              <select
                value={draftBrief.objective}
                onChange={(event) => updateBrief({ objective: event.currentTarget.value as CreativeObjective })}
              >
                {objectives.map((objective) => <option key={objective}>{objective}</option>)}
              </select>
            </label>
            <label className="creative-studio-flow__field">
              <span>Style</span>
              <select
                value={draftBrief.style}
                onChange={(event) => updateBrief({ style: event.currentTarget.value as CreativeStyle })}
              >
                {styles.map((style) => <option key={style}>{style}</option>)}
              </select>
            </label>
            <label className="creative-studio-flow__field">
              <span>Format</span>
              <select
                value={draftBrief.canvas.format}
                onChange={(event) => updateBrief({
                  canvas: canvasForFormat(event.currentTarget.value as CanvasFormat, draftBrief.canvas),
                })}
              >
                <option value="feed-4-5">Feed 4:5</option>
                <option value="story-9-16">Stories 9:16</option>
                <option value="square-1-1">Square 1:1</option>
                <option value="tweet-card">Tweet Card</option>
                <option value="custom">Custom</option>
              </select>
            </label>
            {draftBrief.canvas.format === 'custom' ? (
              <div className="creative-studio-flow__inline-fields creative-studio-flow__field--wide">
                <label className="creative-studio-flow__field">
                  <span>Width</span>
                  <input
                    type="number" min={1} value={draftBrief.canvas.width}
                    onChange={(event) => updateBrief({ canvas: {
                      ...draftBrief.canvas, width: Math.max(1, event.currentTarget.valueAsNumber || 1),
                    } })}
                  />
                </label>
                <label className="creative-studio-flow__field">
                  <span>Height</span>
                  <input
                    type="number" min={1} value={draftBrief.canvas.height}
                    onChange={(event) => updateBrief({ canvas: {
                      ...draftBrief.canvas, height: Math.max(1, event.currentTarget.valueAsNumber || 1),
                    } })}
                  />
                </label>
              </div>
            ) : null}
          </fieldset>

          <fieldset className="creative-studio-flow__section" disabled={busy}>
            <legend>Assets</legend>
            <label className="creative-studio-flow__field">
              <span>Asset role</span>
              <select
                value={assetKind}
                onChange={(event) => setAssetKind(
                  event.currentTarget.value as Exclude<CreativeAssetKind, 'reference'>,
                )}
              >
                {assetKinds.map((kind) => <option key={kind}>{kind}</option>)}
              </select>
            </label>
            <label className="creative-studio-flow__upload">
              <span>Add image asset</span>
              <input type="file" accept="image/*" onChange={addAsset} />
            </label>
            <div className="creative-studio-flow__items creative-studio-flow__field--wide">
              {assets.filter((asset) => asset.kind !== 'reference').map((asset) => (
                <article key={asset.id} className="creative-studio-flow__item">
                  <div>
                    <strong>{asset.metadata?.originalFileName ?? asset.id}</strong>
                    <span>{asset.kind} · {asset.width}×{asset.height}</span>
                  </div>
                  <button type="button" onClick={() => removeAsset(asset)}>Remove</button>
                </article>
              ))}
            </div>
          </fieldset>

          <fieldset className="creative-studio-flow__section" disabled={busy}>
            <legend>Visual references</legend>
            <label className="creative-studio-flow__field">
              <span>Purpose</span>
              <input
                value={referencePurpose}
                placeholder="Hierarchy, rhythm, UGC feeling…"
                onChange={(event) => setReferencePurpose(event.currentTarget.value)}
              />
            </label>
            <label className="creative-studio-flow__upload">
              <span>Add reference</span>
              <input type="file" accept="image/*" onChange={addReference} />
            </label>
            <p className="creative-studio-flow__hint creative-studio-flow__field--wide">
              References are analyzed as abstract visual signals, never copied as templates.
            </p>
            <div className="creative-studio-flow__items creative-studio-flow__field--wide">
              {references.map((reference) => {
                const asset = assets.find((item) => item.id === reference.assetId)
                return (
                  <article key={reference.id} className="creative-studio-flow__item">
                    <div>
                      <strong>{asset?.metadata?.originalFileName ?? reference.id}</strong>
                      <span>{reference.purpose ?? 'General visual reference'}</span>
                    </div>
                    <button type="button" onClick={() => removeReference(reference)}>Remove</button>
                  </article>
                )
              })}
            </div>
          </fieldset>

          <fieldset className="creative-studio-flow__section" disabled={busy}>
            <legend>Creative controls</legend>
            <label className="creative-studio-flow__field creative-studio-flow__field--wide">
              <span>Clean ↔ Raw: {Math.round(draftBrief.ugcIntensity.value * 100)}%</span>
              <input
                type="range" min={0} max={1} step={0.01}
                value={draftBrief.ugcIntensity.value}
                onChange={(event) => updateBrief({ ugcIntensity: {
                  ...draftBrief.ugcIntensity, value: event.currentTarget.valueAsNumber,
                } })}
              />
            </label>
            <label className="creative-studio-flow__field">
              <span>Composition</span>
              <select
                value={draftBrief.composition}
                onChange={(event) => updateBrief({
                  composition: event.currentTarget.value as CompositionStrategy,
                })}
              >
                {compositions.map((composition) => <option key={composition}>{composition}</option>)}
              </select>
            </label>
            <label className="creative-studio-flow__field">
              <span>Brand presence</span>
              <select
                value={draftBrief.brandPresence}
                onChange={(event) => updateBrief({
                  brandPresence: event.currentTarget.value as BrandPresence,
                })}
              >
                {brandPresences.map((presence) => <option key={presence}>{presence}</option>)}
              </select>
            </label>

            <div className="creative-studio-flow__subsection creative-studio-flow__field--wide">
              <h3>Project palette overrides</h3>
              <div className="creative-studio-flow__palette">
                {(['primary', 'secondary', 'accent', 'background', 'text', 'muted'] as const).map(
                  (key) => (
                    <label key={key} className="creative-studio-flow__color">
                      <span>{key}</span>
                      <input
                        type="color" value={palette[key]}
                        onChange={(event) => updatePalette(key, event.currentTarget.value)}
                      />
                      <input
                        value={palette[key]}
                        onChange={(event) => updatePalette(key, event.currentTarget.value)}
                      />
                    </label>
                  ),
                )}
                {Object.entries(palette.custom).map(([name, value]) => (
                  <label key={name} className="creative-studio-flow__color">
                    <span>{name}</span>
                    <input
                      type="color" value={value}
                      onChange={(event) => updateCustomColor(name, event.currentTarget.value)}
                    />
                    <input
                      value={value}
                      onChange={(event) => updateCustomColor(name, event.currentTarget.value)}
                    />
                  </label>
                ))}
              </div>
              <div className="creative-studio-flow__custom-color">
                <input
                  aria-label="Custom color name" placeholder="Token name"
                  value={customColorName}
                  onChange={(event) => setCustomColorName(event.currentTarget.value)}
                />
                <input
                  type="color" aria-label="Custom color value" value={customColorValue}
                  onChange={(event) => setCustomColorValue(event.currentTarget.value)}
                />
                <button type="button" onClick={addCustomColor}>Add color</button>
              </div>
            </div>

            <div className="creative-studio-flow__subsection creative-studio-flow__field--wide">
              <h3>Project typography overrides</h3>
              <div className="creative-studio-flow__typography">
                {(['display', 'body', 'caption'] as const).map((role) => (
                  <div key={role} className="creative-studio-flow__type-row">
                    <strong>{role}</strong>
                    <label className="creative-studio-flow__field">
                      <span>Font family</span>
                      <input
                        value={typography[role].fontFamily}
                        onChange={(event) => updateTypography(role, {
                          fontFamily: event.currentTarget.value,
                        })}
                      />
                    </label>
                    <label className="creative-studio-flow__field">
                      <span>Weight</span>
                      <input
                        type="number" min={100} max={900} step={100}
                        value={typography[role].fontWeight}
                        onChange={(event) => updateTypography(role, {
                          fontWeight: event.currentTarget.valueAsNumber,
                        })}
                      />
                    </label>
                    <label className="creative-studio-flow__field">
                      <span>Line height</span>
                      <input
                        type="number" min={0.1} step={0.05}
                        value={typography[role].lineHeight ?? 1}
                        onChange={(event) => updateTypography(role, {
                          lineHeight: event.currentTarget.valueAsNumber,
                        })}
                      />
                    </label>
                    <label className="creative-studio-flow__field">
                      <span>Letter spacing</span>
                      <input
                        type="number" step={0.01}
                        value={typography[role].letterSpacing ?? 0}
                        onChange={(event) => updateTypography(role, {
                          letterSpacing: event.currentTarget.valueAsNumber,
                        })}
                      />
                    </label>
                    <label className="creative-studio-flow__field">
                      <span>Alignment</span>
                      <select
                        value={typography[role].textAlign ?? 'left'}
                        onChange={(event) => updateTypography(role, {
                          textAlign: event.currentTarget.value as TypographyDefinition['textAlign'],
                        })}
                      >
                        <option value="left">Left</option>
                        <option value="center">Center</option>
                        <option value="right">Right</option>
                      </select>
                    </label>
                  </div>
                ))}
                <label className="creative-studio-flow__field">
                  <span>Allowed fonts (comma separated)</span>
                  <input
                    value={typography.allowedFonts.join(', ')}
                    onChange={(event) => setBrandOverrides((current) => ({
                      ...current,
                      typography: {
                        ...current.typography,
                        allowedFonts: event.currentTarget.value
                          .split(',').map((font) => font.trim()).filter(Boolean),
                      },
                    }))}
                  />
                </label>
              </div>
            </div>
          </fieldset>

          <button className="creative-studio-flow__generate" type="submit" disabled={busy}>
            {busy ? 'Creating…' : 'Generate 3 directions with AI'}
          </button>
          {error ? (
            <p className="creative-studio-flow__feedback creative-studio-flow__feedback--error" role="alert">
              {error}
            </p>
          ) : null}
          {message ? <p className="creative-studio-flow__feedback" role="status">{message}</p> : null}
        </form>
        <aside className="creative-studio-flow__directions" aria-label="Creative directions">
          <div className="creative-studio-flow__directions-heading">
            <span>Direction set</span><strong>{directions.length}/3</strong>
          </div>
          {directions.length === 0 ? (
            <p className="creative-studio-flow__empty">
              Complete the brief and ask the iNest Creative Engine for three directions.
            </p>
          ) : (
            directions.map((direction, index) => (
              <article
                key={direction.id}
                className={direction.id === selectedDirection?.id
                  ? 'creative-studio-direction creative-studio-direction--selected'
                  : 'creative-studio-direction'}
              >
                <div className={`creative-studio-direction__preview creative-studio-direction__preview--${index + 1}`}>
                  <div className="creative-studio-direction__photo" />
                  <strong>{draftBrief.headline || 'Your headline'}</strong>
                  <span>{direction.typographyCharacter[0]}</span>
                  <i />
                </div>
                <div className="creative-studio-direction__content">
                  <span>Direction {String.fromCharCode(65 + index)}</span>
                  <h2>{direction.name}</h2>
                  <p>{direction.concept}</p>
                  <small>{direction.rationale}</small>
                  <div className="creative-studio-direction__tags">
                    <span>{direction.compositionStrategy}</span>
                    <span>Raw {Math.round(direction.ugcIntensity.value * 100)}%</span>
                  </div>
                  <button
                    type="button" disabled={busy}
                    aria-pressed={direction.id === selectedDirection?.id}
                    onClick={() => chooseDirection(direction)}
                  >
                    {direction.id === selectedDirection?.id ? 'Selected' : 'Choose direction'}
                  </button>
                </div>
              </article>
            ))
          )}
          {selectedDirection ? (
            <section className="creative-studio-flow__refinements" aria-label="Refine composition">
              <div>
                <span>Editable composition</span>
                <strong>Revision {activeRevision.revisionNumber}</strong>
              </div>
              <p>Each refinement creates a new immutable revision and respects active locks.</p>
              <div className="creative-studio-flow__refinement-actions">
                {(Object.entries(REFINEMENT_INTENT_LABELS) as Array<[RefinementIntent, string]>).map(
                  ([intent, label]) => (
                    <button
                      key={intent}
                      type="button"
                      disabled={busy}
                      onClick={() => refineComposition(intent)}
                    >
                      {label}
                    </button>
                  ),
                )}
              </div>
            </section>
          ) : null}
        </aside>
      </div>
    </section>
  )
}
