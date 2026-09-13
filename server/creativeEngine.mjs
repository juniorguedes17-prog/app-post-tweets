import { randomUUID } from 'node:crypto'
import { compositionPlanSchema } from './schemas.mjs'
import {
  analyzeReferences,
  generateImage,
  imageModel,
  structuredResponse,
} from './openaiClient.mjs'
import { resolveUgcGrammar } from './ugcGrammar.mjs'

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, Number(value) || 0))

/** Text font sizes are CSS/canvas pixels, never normalized scene coordinates. */
export const MIN_CANVAS_TEXT_FONT_SIZE = 12
export const MAX_CANVAS_TEXT_FONT_SIZE = 512

export function normalizeCanvasTextFontSize(value, semanticRole = 'text') {
  const fontSize = Number(value)
  if (!Number.isFinite(fontSize) || fontSize < MIN_CANVAS_TEXT_FONT_SIZE || fontSize > MAX_CANVAS_TEXT_FONT_SIZE) {
    const error = new Error(
      `Creative Engine returned an unusable ${semanticRole} fontSize. Expected ${MIN_CANVAS_TEXT_FONT_SIZE}..${MAX_CANVAS_TEXT_FONT_SIZE} canvas pixels.`,
    )
    error.statusCode = 422
    error.code = 'invalid_scene_graph_typography'
    throw error
  }
  return fontSize
}

function imageSize(canvas) {
  if (canvas.width === canvas.height) return { size: '1024x1024', width: 1024, height: 1024 }
  if (canvas.height > canvas.width) return { size: '1024x1536', width: 1024, height: 1536 }
  return { size: '1536x1024', width: 1536, height: 1024 }
}

function baseElement(raw, canvas, id) {
  const x = Math.round(clamp(raw.x, 0, 1) * canvas.width)
  const y = Math.round(clamp(raw.y, 0, 1) * canvas.height)
  return {
    id,
    semanticRole: raw.semanticRole,
    x,
    y,
    width: Math.max(1, Math.round(clamp(raw.width, 0.01, 1) * canvas.width)),
    height: Math.max(1, Math.round(clamp(raw.height, 0.01, 1) * canvas.height)),
    rotation: clamp(raw.rotation, -180, 180),
    zIndex: Math.round(clamp(raw.zIndex, 0, 100)),
    opacity: clamp(raw.opacity, 0, 1),
    visible: true,
    lockState: 'unlocked',
  }
}

function normalizeElement(raw, context) {
  const { canvas, elementId, assetIds, typography, palette } = context
  const base = baseElement(raw, canvas, elementId)
  if (raw.type === 'text') {
    const fontSize = normalizeCanvasTextFontSize(raw.fontSize, raw.semanticRole)
    return {
      ...base,
      type: 'text',
      content: raw.content || '',
      style: {
        fontFamily: raw.fontFamily || typography.body.fontFamily,
        fontWeight: clamp(raw.fontWeight ?? typography.body.fontWeight, 100, 900),
        fontSize,
        lineHeight: Math.max(0.1, Number(raw.lineHeight) || typography.body.lineHeight || 1.2),
        letterSpacing: Number(raw.letterSpacing) || 0,
        textAlign: raw.textAlign || 'left',
        color: raw.color || palette.text,
      },
    }
  }
  if (['image', 'photo', 'product', 'logo'].includes(raw.type)) {
    if (!raw.assetId || !assetIds.has(raw.assetId)) return undefined
    return {
      ...base,
      type: raw.type,
      assetId: raw.assetId,
      style: {
        fit: raw.fit || 'cover',
        crop: {
          x: Number(raw.cropX) || 0,
          y: Number(raw.cropY) || 0,
          zoom: Math.max(0.01, Number(raw.zoom) || 1),
        },
        borderRadius: Math.max(0, Number(raw.borderRadius) || 0),
      },
    }
  }
  if (raw.type === 'shape') {
    return {
      ...base,
      type: 'shape',
      style: {
        shape: raw.shape || 'rectangle',
        ...(raw.fill ? { fill: raw.fill } : {}),
        ...(raw.stroke ? { stroke: raw.stroke } : {}),
        ...(raw.strokeWidth !== null ? { strokeWidth: Math.max(0, Number(raw.strokeWidth) || 0) } : {}),
      },
    }
  }
  if (raw.type === 'annotation') {
    return {
      ...base,
      type: 'annotation',
      ...(raw.content ? { content: raw.content } : {}),
      style: {
        kind: raw.annotationKind || 'scribble',
        ...(raw.color ? { color: raw.color } : {}),
        ...(raw.strokeWidth !== null ? { strokeWidth: Math.max(0, Number(raw.strokeWidth) || 0) } : {}),
      },
    }
  }
  return undefined
}

function resolvedBrand(input) {
  const profile = input.brandProfile
  const palette = {
    ...(profile?.palette ?? {
      primary: '#5F7CFF', secondary: '#7B2CFF', accent: '#7B2CFF',
      background: '#F5F7FA', text: '#050505', muted: '#5F7CFF', custom: {},
    }),
    ...(input.brandOverrides?.palette ?? {}),
  }
  const typography = {
    display: { fontFamily: 'Montserrat', fontWeight: 700, ...(profile?.typography?.display ?? {}), ...(input.brandOverrides?.typography?.display ?? {}) },
    body: { fontFamily: 'Inter', fontWeight: 400, ...(profile?.typography?.body ?? {}), ...(input.brandOverrides?.typography?.body ?? {}) },
    caption: { fontFamily: 'Inter', fontWeight: 500, ...(profile?.typography?.caption ?? {}), ...(input.brandOverrides?.typography?.caption ?? {}) },
  }
  return { palette, typography }
}

function applyElementStyleOverride(element, override) {
  if (!element || !override || !element.style) return element
  const allowedKeys = element.type === 'text'
    ? ['fontFamily', 'fontWeight', 'fontSize', 'lineHeight', 'letterSpacing', 'textAlign', 'color']
    : ['image', 'photo', 'product', 'logo'].includes(element.type)
      ? ['fit', 'crop', 'borderRadius']
      : element.type === 'shape'
        ? ['shape', 'fill', 'stroke', 'strokeWidth']
        : element.type === 'annotation'
          ? ['kind', 'color', 'strokeWidth']
          : []
  const safeOverride = Object.fromEntries(
    allowedKeys.filter((key) => override[key] !== undefined).map((key) => [key, override[key]]),
  )
  if (element.style.crop && safeOverride.crop) {
    safeOverride.crop = { ...element.style.crop, ...safeOverride.crop }
  }
  return { ...element, style: { ...element.style, ...safeOverride } }
}

async function generatedAssets(plan, input) {
  const outputs = []
  const replacements = new Map()
  const target = imageSize(input.canvas)
  for (const request of plan.imageRequests.slice(0, 1)) {
    const existingAsset = input.assets.find((asset) => (
      request.semanticRole === 'product'
        ? asset.kind === 'product'
        : asset.kind === 'photo' || asset.kind === 'image'
    ))
    if (existingAsset) {
      replacements.set(request.id, existingAsset.id)
      continue
    }
    if (!input.brief.imagePolicy.allowAiGeneration) continue
    const assetId = `asset-${randomUUID()}`
    const result = await generateImage({
      prompt: [
        request.prompt,
        'Create only the photographic or product image asset.',
        'Do not add typography, captions, logos, UI, frames, watermarks, or advertising badges.',
        'Keep an authentic Native Instagram and Editorial UGC photographic treatment.',
      ].join(' '),
      size: target.size,
    })
    replacements.set(request.id, assetId)
    outputs.push({
      asset: {
        id: assetId,
        kind: request.semanticRole === 'product' ? 'product' : 'photo',
        source: 'generated',
        storageRef: `indexeddb://assets/${assetId}`,
        mimeType: 'image/png',
        width: target.width,
        height: target.height,
        byteSize: Buffer.byteLength(result.base64, 'base64'),
        createdAt: Date.now(),
        metadata: { subject: request.prompt, altText: request.semanticRole },
      },
      base64: result.base64,
      metadata: result.metadata,
    })
  }
  return { outputs, replacements }
}

function engineInstructions(kind) {
  return [
    'You are the iNest Creative Engine producing an editable scene graph, never a flattened poster.',
    'Apply Native Instagram + Editorial UGC + Minimal + Raw grammar structurally.',
    'Use normalized 0..1 coordinates and dimensions.',
    `Use real canvas/CSS pixels for every text fontSize (${MIN_CANVAS_TEXT_FONT_SIZE}..${MAX_CANVAS_TEXT_FONT_SIZE}), never normalized 0..1 values.`,
    'Preserve supplied real asset IDs whenever suitable; never request recreation of a supplied product or logo.',
    'Request at most one generated photographic asset and reference its request id from visual elements.',
    'Typography and CTA belong in text elements, never inside generated imagery.',
    'Reference analyses are abstract signals only; do not copy source text, coordinates, or artwork.',
    kind === 'refinement'
      ? 'Create a new revision from the previous revision. Preserve stable element IDs and obey every lock snapshot exactly.'
      : 'Create a complete, immediately usable composition from the selected direction.',
  ].join(' ')
}

export async function composeOrRefine(payload, kind) {
  const input = payload.input
  const previous = input.previousRevision
  if (!previous?.compositionId) {
    const error = new Error('A base CompositionRevision is required for composition generation.')
    error.statusCode = 400
    throw error
  }
  const suppliedVisualAssets = input.assets.filter((asset) => (
    asset.kind === 'image' || asset.kind === 'photo' || asset.kind === 'product'
  ))
  if (input.brief.imagePolicy.originalRequired && suppliedVisualAssets.length === 0) {
    const error = new Error('The brief requires an original image asset before composition.')
    error.statusCode = 400
    throw error
  }
  const references = await analyzeReferences({
    userReferences: payload.userReferences,
    includeOfficial: true,
  })
  const result = await structuredResponse({
    name: kind === 'refinement' ? 'creative_refinement_plan' : 'creative_composition_plan',
    schema: compositionPlanSchema,
    instructions: engineInstructions(kind),
    input: JSON.stringify({
      brief: input.brief,
      canvas: input.canvas,
      brandProfile: input.brandProfile,
      brandOverrides: input.brandOverrides,
      grammar: resolveUgcGrammar(input.brandProfile, input.brief.ugcIntensity),
      direction: input.direction,
      availableAssets: input.assets,
      previousRevision: kind === 'refinement' ? previous : undefined,
      locks: input.locks,
      refinementIntent: input.refinementIntent,
      referenceAnalyses: [
        ...references.officialAnalyses.map((item) => item.analysis),
        ...references.userAnalyses.map((item) => item.analysis),
      ],
    }),
  })
  const generated = await generatedAssets(result.data, input)
  const assetIds = new Set(input.assets.map((asset) => asset.id))
  for (const id of [
    input.brandProfile?.logos?.primaryAssetId,
    ...(input.brandProfile?.logos?.alternateAssetIds ?? []),
  ]) if (id) assetIds.add(id)
  for (const output of generated.outputs) assetIds.add(output.asset.id)

  const { palette, typography } = resolvedBrand(input)
  const usedIds = new Set()
  const previousIds = new Set(previous.elements.map((element) => element.id))
  const elements = result.data.elements.flatMap((raw) => {
    if (generated.replacements.has(raw.assetId)) raw.assetId = generated.replacements.get(raw.assetId)
    const requestedId = String(raw.id || '')
    const elementId = requestedId && previousIds.has(requestedId) && !usedIds.has(requestedId)
      ? requestedId
      : `element-${randomUUID()}`
    usedIds.add(elementId)
    const element = normalizeElement(raw, {
      canvas: input.canvas,
      elementId,
      assetIds,
      typography,
      palette,
    })
    const override = input.brandOverrides?.elementOverrides?.[elementId]
    return element ? [applyElementStyleOverride(element, override)] : []
  })
  if (elements.length === 0) throw new Error('Creative Engine returned no valid scene elements.')

  return {
    revision: {
      id: `revision-${randomUUID()}`,
      compositionId: previous.compositionId,
      revisionNumber: previous.revisionNumber + 1,
      elements,
      createdAt: Date.now(),
      origin: kind === 'refinement' ? 'refinement' : 'generation',
      generationId: `generation-${randomUUID()}`,
      parentRevisionId: previous.id,
      label: result.data.label,
    },
    generatedAssets: generated.outputs,
    referenceAnalyses: references.userAnalyses,
    metadata: {
      ...result.metadata,
      parameters: {
        ...result.metadata.parameters,
        imageModel: generated.outputs.length > 0 ? imageModel : null,
        generatedAssetCount: generated.outputs.length,
        officialReferenceCount: references.officialAnalyses.length,
        userReferenceCount: references.userAnalyses.length,
      },
    },
  }
}

export async function analyzeSingleReference(payload) {
  const result = await analyzeReferences({
    userReferences: [payload.reference],
    includeOfficial: false,
  })
  const match = result.userAnalyses.find((item) => item.id === payload.reference.id)
  if (!match) throw new Error('Reference analysis could not be produced.')
  return { analysis: match.analysis, metadata: result.metadata }
}
