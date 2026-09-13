import { randomUUID } from 'node:crypto'
import { directionsSchema, referenceAnalysisSchema } from './schemas.mjs'
import { loadOfficialReferenceInputs } from './referenceCatalog.mjs'
import { resolveUgcGrammar } from './ugcGrammar.mjs'

export const textModel = process.env.OPENAI_TEXT_MODEL || 'gpt-6-astra'
export const imageModel = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2.5-sunburst'

function apiKey() {
  const value = process.env.OPENAI_API_KEY
  if (!value) {
    const error = new Error('OPENAI_API_KEY is not configured on the server.')
    error.statusCode = 503
    throw error
  }
  return value
}

async function openAIRequest(pathname, body) {
  const response = await fetch(`https://api.openai.com/v1${pathname}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(payload?.error?.message || `OpenAI request failed with ${response.status}.`)
    error.statusCode = response.status
    error.code = payload?.error?.code
    throw error
  }
  return payload
}

function responseText(response) {
  if (typeof response.output_text === 'string') return response.output_text
  for (const item of response.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === 'output_text' && typeof content.text === 'string') return content.text
    }
  }
  throw new Error('OpenAI response did not contain structured output text.')
}

export async function structuredResponse({ name, schema, instructions, input, images = [] }) {
  const content = [{ type: 'input_text', text: input }]
  for (const image of images) {
    if (!String(image.imageDataUrl).startsWith('data:image/')) continue
    content.push({ type: 'input_image', image_url: image.imageDataUrl, detail: 'low' })
  }
  const startedAt = Date.now()
  const response = await openAIRequest('/responses', {
    model: textModel,
    store: false,
    instructions,
    input: [{ role: 'user', content }],
    text: {
      format: {
        type: 'json_schema',
        name,
        strict: true,
        schema,
      },
    },
  })
  return {
    data: JSON.parse(responseText(response)),
    metadata: {
      provider: 'openai',
      model: response.model || textModel,
      requestId: response.id,
      durationMs: Date.now() - startedAt,
      parameters: {
        usage: response.usage ?? null,
      },
    },
  }
}

export async function generateImage({ prompt, size }) {
  const startedAt = Date.now()
  const response = await openAIRequest('/images/generations', {
    model: imageModel,
    prompt,
    size,
    quality: process.env.OPENAI_IMAGE_QUALITY || 'low',
    output_format: 'png',
  })
  const image = response.data?.[0]
  if (!image?.b64_json) throw new Error('Images API returned no image bytes.')
  return {
    base64: image.b64_json,
    metadata: {
      provider: 'openai',
      model: imageModel,
      durationMs: Date.now() - startedAt,
      parameters: {
        size,
        quality: process.env.OPENAI_IMAGE_QUALITY || 'low',
        usage: response.usage ?? null,
      },
    },
  }
}

function normalizeAnalysis(raw, input, metadata) {
  const clamp = (value) => Math.min(1, Math.max(0, Number(value) || 0))
  return {
    id: input.id,
    analysis: {
      hierarchy: raw.hierarchy,
      imageTextRatio: clamp(raw.imageTextRatio),
      visualDensity: clamp(raw.visualDensity),
      negativeSpace: clamp(raw.negativeSpace),
      asymmetry: clamp(raw.asymmetry),
      typographyCharacter: raw.typographyCharacter,
      annotationPresence: clamp(raw.annotationPresence),
      rhythm: raw.rhythm,
      ugcFeeling: clamp(raw.ugcFeeling),
      analyzedAt: Date.now(),
      analyzerVersion: `${metadata.model}:reference-v1`,
    },
  }
}

async function analyzeReferenceImages(inputs) {
  if (inputs.length === 0) return { analyses: [], metadata: undefined }
  const descriptor = inputs.map((input, index) => ({
    imageIndex: index + 1,
    id: input.id,
    purpose: input.purpose,
  }))
  const result = await structuredResponse({
    name: 'creative_reference_analysis',
    schema: referenceAnalysisSchema,
    instructions: [
      'Analyze visual references only as abstract design characteristics.',
      'Never reproduce copy, coordinates, protected artwork, or a reference layout.',
      'Return one analysis per supplied image, preserving each descriptor id.',
    ].join(' '),
    input: JSON.stringify({ descriptors: descriptor }),
    images: inputs,
  })
  const byId = new Map(result.data.analyses.map((analysis) => [analysis.id, analysis]))
  return {
    analyses: inputs.map((input, index) => normalizeAnalysis(
      byId.get(input.id) ?? result.data.analyses[index],
      input,
      result.metadata,
    )),
    metadata: result.metadata,
  }
}

let officialAnalysesPromise

async function officialAnalyses() {
  if (!officialAnalysesPromise) {
    officialAnalysesPromise = loadOfficialReferenceInputs().then(analyzeReferenceImages)
  }
  return officialAnalysesPromise
}

export async function analyzeReferences({ userReferences = [], includeOfficial = true }) {
  const supplied = []
  const preserved = []
  for (const reference of userReferences) {
    if (reference.analysis) preserved.push({ id: reference.id, analysis: reference.analysis })
    else if (reference.imageDataUrl) supplied.push(reference)
  }
  const [userResult, officialResult] = await Promise.all([
    analyzeReferenceImages(supplied),
    includeOfficial ? officialAnalyses() : Promise.resolve({ analyses: [], metadata: undefined }),
  ])
  return {
    userAnalyses: [...preserved, ...userResult.analyses],
    officialAnalyses: officialResult.analyses,
    metadata: userResult.metadata ?? officialResult.metadata,
  }
}

export async function proposeDirections(payload) {
  const references = await analyzeReferences({
    userReferences: payload.userReferences,
    includeOfficial: true,
  })
  const input = payload.input
  const result = await structuredResponse({
    name: 'creative_directions',
    schema: directionsSchema,
    instructions: [
      'You are the iNest Creative Engine.',
      'Create exactly three structurally distinct creative directions.',
      'Apply Native Instagram + Editorial UGC + Minimal + Raw grammar.',
      'Treat reference analyses as abstract signals only, never as templates or copy targets.',
      'Preserve brand rules while allowing authorized project overrides.',
    ].join(' '),
    input: JSON.stringify({
      brief: input.brief,
      brandProfile: input.brandProfile,
      brandOverrides: input.brandOverrides,
      grammar: resolveUgcGrammar(input.brandProfile, input.brief.ugcIntensity),
      referenceAnalyses: [
        ...references.officialAnalyses.map((item) => item.analysis),
        ...references.userAnalyses.map((item) => item.analysis),
      ],
      availableAssets: input.assets,
    }),
  })
  const generationId = `generation-${randomUUID()}`
  const now = Date.now()
  const directions = result.data.directions.map((direction, index) => ({
    id: `direction-${randomUUID()}`,
    projectId: input.brief.projectId,
    name: direction.name,
    concept: direction.concept,
    rationale: direction.rationale,
    hierarchy: direction.hierarchy,
    imageTreatment: {
      dominant: direction.imageDominant,
      modes: direction.imageModes,
      notes: direction.imageNotes,
    },
    compositionStrategy: direction.compositionStrategy,
    typographyCharacter: direction.typographyCharacter,
    ugcIntensity: input.brief.ugcIntensity,
    brandPresence: input.brief.brandPresence,
    preservedRoles: direction.preservedRoles,
    variableRoles: direction.variableRoles,
    generationId,
    createdAt: now + index,
  }))
  return {
    directions,
    referenceAnalyses: references.userAnalyses,
    metadata: {
      ...result.metadata,
      parameters: {
        ...result.metadata.parameters,
        generationId,
        officialReferenceCount: references.officialAnalyses.length,
        userReferenceCount: references.userAnalyses.length,
      },
    },
  }
}
