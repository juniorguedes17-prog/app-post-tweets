import { useEffect, useMemo, useState, type ChangeEvent, type CSSProperties } from 'react'
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
import type { CreativeAssetId, ElementLockId, VisualReferenceId } from '../domain/ids'
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
import { propagateLocksToRevision } from '../locks/lockEngine'
import {
  assetKindLabel,
  brandPresenceLabel,
  compositionStrategyLabel,
  creativeObjectiveLabel,
  creativeStyleLabel,
} from '../presentationLabels'
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

const typographyRoleLabels = {
  display: 'Destaque',
  body: 'Corpo',
  caption: 'Legenda',
} as const

const paletteRoleLabels = {
  primary: 'Primária',
  secondary: 'Secundária',
  accent: 'Destaque',
  background: 'Fundo',
  text: 'Texto',
  muted: 'Suave',
} as const

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
  onCompositionReady?: (
    composition: Composition,
    revision: CompositionRevision,
    locks: ElementLock[],
    document: CreativeDocument,
  ) => void
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
      image.onerror = () => reject(new Error('Não foi possível ler as dimensões da imagem.'))
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

  useEffect(() => {
    setActiveDocument(document)
    setActiveComposition(composition)
    setActiveRevision(currentRevision)
  }, [composition, currentRevision, document])

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
      setError(cause instanceof Error ? cause.message : 'Não foi possível concluir a operação do Creative Studio.')
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
      setMessage('Imagem salva neste dispositivo.')
    })
  }

  const removeAsset = (asset: CreativeAsset) => {
    void runAction(async () => {
      const nextDocument = detachAsset(activeDocument, asset.id, Date.now())
      await repository.removeAssetFromDocument(asset.id, nextDocument)
      setAssets((current) => current.filter((item) => item.id !== asset.id))
      setActiveDocument(nextDocument)
      setMessage('Imagem removida.')
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
      setMessage('Referência visual salva como entrada estruturada.')
    })
  }

  const removeReference = (reference: VisualReference) => {
    void runAction(async () => {
      const nextDocument = detachReference(activeDocument, reference, Date.now())
      await repository.removeReferenceFromDocument(reference.id, reference.assetId, nextDocument)
      setReferences((current) => current.filter((item) => item.id !== reference.id))
      setAssets((current) => current.filter((asset) => asset.id !== reference.assetId))
      setActiveDocument(nextDocument)
      setMessage('Referência visual removida.')
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
    propagatedLocks: ElementLock[] = [],
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
      pages: [
        ...(selectedDocument.pages ?? []).filter((page) => page.revisionId !== revision.id),
        {
          compositionId: nextComposition.id,
          revisionId: revision.id,
          canvas: nextComposition.canvas,
        },
      ],
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
      locks: propagatedLocks,
    })
    setActiveComposition(nextComposition)
    setActiveRevision(revision)
    setActiveDocument(nextDocument)
    setReferences(nextReferences)
    if (generatedAssets.length) {
      setAssets((current) => [...current, ...generatedAssets.map(({ asset }) => asset)])
    }
    onCompositionReady?.(nextComposition, revision, propagatedLocks, nextDocument)
  }

  const generateDirections = () => {
    void runAction(async () => {
      const now = Date.now()
      const nextBrief = { ...draftBrief, updatedAt: now }
      const result = await engine.proposeDirections(engineInput(nextBrief))
      const nextDirections = result.output
      if (nextDirections.length !== 3) throw new Error('O Creative Engine deve retornar três direções.')
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
      setMessage('Três direções do Creative Engine foram geradas e salvas.')
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
      setMessage(`${direction.name} foi selecionada e composta como revisão ${result.output.revisionNumber}.`)
    })
  }

  const refineComposition = (intent: RefinementIntent) => {
    if (!selectedDirection) return
    void runAction(async () => {
      const result = await engine.refine(engineInput(draftBrief, selectedDirection, intent))
      const propagatedLocks = propagateLocksToRevision(
        activeRevision,
        result.output,
        locks,
        () => generatedId('lock') as ElementLockId,
      )
      await persistEngineRevision(
        result.output,
        selectedDirection,
        activeDocument,
        propagatedLocks,
      )
      setMessage(`${REFINEMENT_INTENT_LABELS[intent]} criou a revisão ${result.output.revisionNumber}.`)
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
    <section className="creative-studio-flow" style={previewStyle} aria-label="Fluxo de direções criativas">
      <header className="creative-studio-flow__header">
        <div><span>Creative Studio</span><h1>Briefing → Direções</h1></div>
        <p>{project.name}</p>
      </header>

      <div className="creative-studio-flow__layout">
        <form
          className="creative-studio-flow__form"
          onSubmit={(event) => { event.preventDefault(); generateDirections() }}
        >
          <fieldset className="creative-studio-flow__section" disabled={busy}>
            <legend>Briefing</legend>
            <label className="creative-studio-flow__field creative-studio-flow__field--wide">
              <span>Conteúdo</span>
              <textarea
                rows={4}
                value={draftBrief.content}
                onChange={(event) => updateBrief({ content: event.currentTarget.value })}
              />
            </label>
            <label className="creative-studio-flow__field creative-studio-flow__field--wide">
              <span>Título</span>
              <input
                value={draftBrief.headline}
                onChange={(event) => updateBrief({ headline: event.currentTarget.value })}
              />
            </label>
            <label className="creative-studio-flow__field creative-studio-flow__field--wide">
              <span>Texto de apoio</span>
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
              <span>Objetivo</span>
              <select
                value={draftBrief.objective}
                onChange={(event) => updateBrief({ objective: event.currentTarget.value as CreativeObjective })}
              >
                {objectives.map((objective) => <option key={objective}>{creativeObjectiveLabel(objective)}</option>)}
              </select>
            </label>
            <label className="creative-studio-flow__field">
              <span>Estilo</span>
              <select
                value={draftBrief.style}
                onChange={(event) => updateBrief({ style: event.currentTarget.value as CreativeStyle })}
              >
                {styles.map((style) => <option key={style}>{creativeStyleLabel(style)}</option>)}
              </select>
            </label>
            <label className="creative-studio-flow__field">
              <span>Formato</span>
              <select
                value={draftBrief.canvas.format}
                onChange={(event) => updateBrief({
                  canvas: canvasForFormat(event.currentTarget.value as CanvasFormat, draftBrief.canvas),
                })}
              >
                <option value="feed-4-5">Feed 4:5</option>
                <option value="story-9-16">Stories 9:16</option>
                <option value="square-1-1">Quadrado 1:1</option>
                <option value="tweet-card">Tweet Card</option>
                <option value="custom">Personalizado</option>
              </select>
            </label>
            {draftBrief.canvas.format === 'custom' ? (
              <div className="creative-studio-flow__inline-fields creative-studio-flow__field--wide">
                <label className="creative-studio-flow__field">
                  <span>Largura</span>
                  <input
                    type="number" min={1} value={draftBrief.canvas.width}
                    onChange={(event) => updateBrief({ canvas: {
                      ...draftBrief.canvas, width: Math.max(1, event.currentTarget.valueAsNumber || 1),
                    } })}
                  />
                </label>
                <label className="creative-studio-flow__field">
                  <span>Altura</span>
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
            <legend>Imagens</legend>
            <label className="creative-studio-flow__field">
              <span>Tipo de imagem</span>
              <select
                value={assetKind}
                onChange={(event) => setAssetKind(
                  event.currentTarget.value as Exclude<CreativeAssetKind, 'reference'>,
                )}
              >
                {assetKinds.map((kind) => <option key={kind}>{assetKindLabel(kind)}</option>)}
              </select>
            </label>
            <label className="creative-studio-flow__upload">
              <span>Adicionar imagem</span>
              <input type="file" accept="image/*" onChange={addAsset} />
            </label>
            <div className="creative-studio-flow__items creative-studio-flow__field--wide">
              {assets.filter((asset) => asset.kind !== 'reference').map((asset) => (
                <article key={asset.id} className="creative-studio-flow__item">
                  <div>
                    <strong>{asset.metadata?.originalFileName ?? asset.id}</strong>
                    <span>{assetKindLabel(asset.kind)} · {asset.width}×{asset.height}</span>
                  </div>
                  <button type="button" onClick={() => removeAsset(asset)}>Remover</button>
                </article>
              ))}
            </div>
          </fieldset>

          <fieldset className="creative-studio-flow__section" disabled={busy}>
            <legend>Referências visuais</legend>
            <label className="creative-studio-flow__field">
              <span>Objetivo da referência</span>
              <input
                value={referencePurpose}
                placeholder="Hierarquia, ritmo, sensação UGC…"
                onChange={(event) => setReferencePurpose(event.currentTarget.value)}
              />
            </label>
            <label className="creative-studio-flow__upload">
              <span>Adicionar referência</span>
              <input type="file" accept="image/*" onChange={addReference} />
            </label>
            <p className="creative-studio-flow__hint creative-studio-flow__field--wide">
              As referências são analisadas como sinais visuais abstratos e nunca copiadas como templates.
            </p>
            <div className="creative-studio-flow__items creative-studio-flow__field--wide">
              {references.map((reference) => {
                const asset = assets.find((item) => item.id === reference.assetId)
                return (
                  <article key={reference.id} className="creative-studio-flow__item">
                    <div>
                      <strong>{asset?.metadata?.originalFileName ?? reference.id}</strong>
                      <span>{reference.purpose ?? 'Referência visual geral'}</span>
                    </div>
                    <button type="button" onClick={() => removeReference(reference)}>Remover</button>
                  </article>
                )
              })}
            </div>
          </fieldset>

          <fieldset className="creative-studio-flow__section" disabled={busy}>
            <legend>Controles criativos</legend>
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
              <span>Composição</span>
              <select
                value={draftBrief.composition}
                onChange={(event) => updateBrief({
                  composition: event.currentTarget.value as CompositionStrategy,
                })}
              >
                {compositions.map((composition) => <option key={composition}>{compositionStrategyLabel(composition)}</option>)}
              </select>
            </label>
            <label className="creative-studio-flow__field">
              <span>Presença da marca</span>
              <select
                value={draftBrief.brandPresence}
                onChange={(event) => updateBrief({
                  brandPresence: event.currentTarget.value as BrandPresence,
                })}
              >
                {brandPresences.map((presence) => <option key={presence}>{brandPresenceLabel(presence)}</option>)}
              </select>
            </label>

            <div className="creative-studio-flow__subsection creative-studio-flow__field--wide">
              <h3>Paleta do projeto</h3>
              <div className="creative-studio-flow__palette">
                {(['primary', 'secondary', 'accent', 'background', 'text', 'muted'] as const).map(
                  (key) => (
                    <label key={key} className="creative-studio-flow__color">
                      <span>{paletteRoleLabels[key]}</span>
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
                  aria-label="Nome da cor personalizada" placeholder="Nome da cor"
                  value={customColorName}
                  onChange={(event) => setCustomColorName(event.currentTarget.value)}
                />
                <input
                  type="color" aria-label="Valor da cor personalizada" value={customColorValue}
                  onChange={(event) => setCustomColorValue(event.currentTarget.value)}
                />
                <button type="button" onClick={addCustomColor}>Adicionar cor</button>
              </div>
            </div>

            <div className="creative-studio-flow__subsection creative-studio-flow__field--wide">
              <h3>Tipografia do projeto</h3>
              <div className="creative-studio-flow__typography">
                {(['display', 'body', 'caption'] as const).map((role) => (
                  <div key={role} className="creative-studio-flow__type-row">
                    <strong>{typographyRoleLabels[role]}</strong>
                    <label className="creative-studio-flow__field">
                      <span>Família tipográfica</span>
                      <input
                        value={typography[role].fontFamily}
                        onChange={(event) => updateTypography(role, {
                          fontFamily: event.currentTarget.value,
                        })}
                      />
                    </label>
                    <label className="creative-studio-flow__field">
                      <span>Peso</span>
                      <input
                        type="number" min={100} max={900} step={100}
                        value={typography[role].fontWeight}
                        onChange={(event) => updateTypography(role, {
                          fontWeight: event.currentTarget.valueAsNumber,
                        })}
                      />
                    </label>
                    <label className="creative-studio-flow__field">
                      <span>Altura da linha</span>
                      <input
                        type="number" min={0.1} step={0.05}
                        value={typography[role].lineHeight ?? 1}
                        onChange={(event) => updateTypography(role, {
                          lineHeight: event.currentTarget.valueAsNumber,
                        })}
                      />
                    </label>
                    <label className="creative-studio-flow__field">
                      <span>Espaçamento entre letras</span>
                      <input
                        type="number" step={0.01}
                        value={typography[role].letterSpacing ?? 0}
                        onChange={(event) => updateTypography(role, {
                          letterSpacing: event.currentTarget.valueAsNumber,
                        })}
                      />
                    </label>
                    <label className="creative-studio-flow__field">
                      <span>Alinhamento</span>
                      <select
                        value={typography[role].textAlign ?? 'left'}
                        onChange={(event) => updateTypography(role, {
                          textAlign: event.currentTarget.value as TypographyDefinition['textAlign'],
                        })}
                      >
                          <option value="left">Esquerda</option>
                          <option value="center">Centro</option>
                          <option value="right">Direita</option>
                      </select>
                    </label>
                  </div>
                ))}
                <label className="creative-studio-flow__field">
                  <span>Fontes permitidas (separadas por vírgula)</span>
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
            {busy ? 'Criando…' : 'Gerar 3 direções com IA'}
          </button>
          {error ? (
            <p className="creative-studio-flow__feedback creative-studio-flow__feedback--error" role="alert">
              {error}
            </p>
          ) : null}
          {message ? <p className="creative-studio-flow__feedback" role="status">{message}</p> : null}
        </form>
        <aside className="creative-studio-flow__directions" aria-label="Direções criativas">
          <div className="creative-studio-flow__directions-heading">
            <span>Direções criativas</span><strong>{directions.length}/3</strong>
          </div>
          {directions.length === 0 ? (
            <p className="creative-studio-flow__empty">
              Complete o briefing e peça três direções ao iNest Creative Engine.
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
                  <strong>{draftBrief.headline || 'Seu título'}</strong>
                  <span>{direction.typographyCharacter[0]}</span>
                  <i />
                </div>
                <div className="creative-studio-direction__content">
                  <span>Direção {String.fromCharCode(65 + index)}</span>
                  <h2>{direction.name}</h2>
                  <p>{direction.concept}</p>
                  <small>{direction.rationale}</small>
                  <div className="creative-studio-direction__tags">
                    <span>{compositionStrategyLabel(direction.compositionStrategy)}</span>
                    <span>Raw {Math.round(direction.ugcIntensity.value * 100)}%</span>
                  </div>
                  <button
                    type="button" disabled={busy}
                    aria-pressed={direction.id === selectedDirection?.id}
                    onClick={() => chooseDirection(direction)}
                  >
                    {direction.id === selectedDirection?.id ? 'Selecionada' : 'Escolher direção'}
                  </button>
                </div>
              </article>
            ))
          )}
          {selectedDirection ? (
            <section className="creative-studio-flow__refinements" aria-label="Refinar composição">
              <div>
                <span>Composição editável</span>
                <strong>Revisão {activeRevision.revisionNumber}</strong>
              </div>
              <p>Cada refinamento cria uma nova revisão imutável e respeita os bloqueios ativos.</p>
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
