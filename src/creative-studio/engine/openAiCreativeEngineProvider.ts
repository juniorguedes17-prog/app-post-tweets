import type { CreativeAsset } from '../domain/creativeAsset'
import type {
  CreativeEngineInput,
  CreativeEngineProvider,
  CreativeEngineResult,
} from '../domain/creativeEngine'
import type { CreativeDirection } from '../domain/creativeDirection'
import type { CompositionRevision } from '../domain/composition'
import type { CreativeAssetId } from '../domain/ids'
import type { GenerationMetadata } from '../domain/generation'
import type { ReferenceAnalysis, VisualReference } from '../domain/visualReference'
import { validateLockedCandidate } from '../locks/lockEngine'
import { locksForRefinementIntent } from './refinementIntents'
import { assertValidEngineRevision } from './sceneGraphValidation'

export type GeneratedAssetOutput = {
  asset: CreativeAsset
  bytes: Blob
  metadata?: GenerationMetadata
}

export type OpenAICreativeEngineProviderOptions = {
  baseUrl?: string
  resolveAssetBytes?: (assetId: CreativeAssetId) => Promise<Blob | undefined>
}

type GatewayResponse<T> = {
  metadata: GenerationMetadata
} & T

type CreativeEngineRequestEvent = {
  requestId: string
  pathname: string
  active: boolean
  durationMs?: number
  status?: number
  error?: { name: string; message: string }
}

function reportRequest(event: 'start' | 'success' | 'error', details: CreativeEngineRequestEvent) {
  const payload = { event, ...details }
  console.info('[creative-observability]', 'creative-engine:request', payload)
  window.dispatchEvent(new CustomEvent<CreativeEngineRequestEvent>('inest:creative-engine-request', {
    detail: payload,
  }))
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('Não foi possível codificar a imagem de referência.'))
    reader.readAsDataURL(blob)
  })
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return new Blob([bytes], { type: mimeType })
}

export class CreativeEngineGatewayError extends Error {
  constructor(message: string, readonly statusCode: number) {
    super(message)
    this.name = 'CreativeEngineGatewayError'
  }
}

export class OpenAICreativeEngineProvider implements CreativeEngineProvider {
  private readonly baseUrl: string
  private readonly resolveAssetBytes?: OpenAICreativeEngineProviderOptions['resolveAssetBytes']
  private generatedAssets: GeneratedAssetOutput[] = []
  private referenceAnalyses = new Map<string, ReferenceAnalysis>()

  constructor(options: OpenAICreativeEngineProviderOptions = {}) {
    this.baseUrl = (options.baseUrl ?? import.meta.env.VITE_CREATIVE_ENGINE_URL ?? '').replace(/\/$/, '')
    this.resolveAssetBytes = options.resolveAssetBytes
  }

  drainGeneratedAssets(): GeneratedAssetOutput[] {
    const outputs = this.generatedAssets
    this.generatedAssets = []
    return outputs
  }

  drainReferenceAnalyses(): Map<string, ReferenceAnalysis> {
    const analyses = this.referenceAnalyses
    this.referenceAnalyses = new Map()
    return analyses
  }

  private async request<T>(pathname: string, body: unknown): Promise<T> {
    const requestId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${pathname}`
    const startedAt = performance.now()
    reportRequest('start', { requestId, pathname, active: true })
    try {
      const response = await fetch(`${this.baseUrl}${pathname}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new CreativeEngineGatewayError(
          typeof payload.error === 'string' ? payload.error : 'A solicitação ao Creative Engine falhou.',
          response.status,
        )
      }
      reportRequest('success', {
        requestId,
        pathname,
        active: false,
        status: response.status,
        durationMs: Math.round(performance.now() - startedAt),
      })
      return payload as T
    } catch (cause) {
      const error = cause instanceof Error ? cause : new Error(String(cause))
      reportRequest('error', {
        requestId,
        pathname,
        active: false,
        durationMs: Math.round(performance.now() - startedAt),
        error: { name: error.name, message: error.message },
      })
      throw cause
    }
  }

  private async userReferences(input: CreativeEngineInput) {
    return Promise.all((input.references ?? []).map(async (reference) => {
      if (reference.analysis) return { ...reference }
      const bytes = await this.resolveAssetBytes?.(reference.assetId)
      return {
        ...reference,
        ...(bytes ? { imageDataUrl: await blobToDataUrl(bytes) } : {}),
      }
    }))
  }

  private retainAnalyses(items: Array<{ id: string; analysis: ReferenceAnalysis }> = []) {
    for (const item of items) this.referenceAnalyses.set(item.id, item.analysis)
  }

  private retainGeneratedAssets(
    items: Array<{ asset: CreativeAsset; base64: string; metadata?: GenerationMetadata }> = [],
  ) {
    this.generatedAssets.push(...items.map((item) => ({
      asset: item.asset,
      bytes: base64ToBlob(item.base64, item.asset.mimeType),
      ...(item.metadata ? { metadata: item.metadata } : {}),
    })))
  }

  async proposeDirections(
    input: CreativeEngineInput,
  ): Promise<CreativeEngineResult<CreativeDirection[]>> {
    const response = await this.request<GatewayResponse<{
      directions: CreativeDirection[]
      referenceAnalyses?: Array<{ id: string; analysis: ReferenceAnalysis }>
    }>>('/api/creative/directions', {
      input,
      userReferences: await this.userReferences(input),
    })
    if (response.directions.length !== 3) {
      throw new Error('O Creative Engine deve retornar exatamente três direções.')
    }
    this.retainAnalyses(response.referenceAnalyses)
    return { output: response.directions, metadata: response.metadata }
  }

  private async compositionRequest(
    pathname: '/api/creative/composition' | '/api/creative/refine',
    input: CreativeEngineInput,
  ): Promise<CreativeEngineResult<CompositionRevision>> {
    if (!input.previousRevision) throw new Error('A geração de composição exige uma revisão-base.')
    const response = await this.request<GatewayResponse<{
      revision: CompositionRevision
      generatedAssets?: Array<{ asset: CreativeAsset; base64: string; metadata?: GenerationMetadata }>
      referenceAnalyses?: Array<{ id: string; analysis: ReferenceAnalysis }>
    }>>(pathname, {
      input,
      userReferences: await this.userReferences(input),
    })
    this.retainGeneratedAssets(response.generatedAssets)
    this.retainAnalyses(response.referenceAnalyses)
    const allAssets = [...input.assets, ...this.generatedAssets.map((item) => item.asset)]
    assertValidEngineRevision(response.revision, input.previousRevision, allAssets)
    return { output: response.revision, metadata: response.metadata }
  }

  compose(input: CreativeEngineInput): Promise<CreativeEngineResult<CompositionRevision>> {
    return this.compositionRequest('/api/creative/composition', input)
  }

  async refine(input: CreativeEngineInput): Promise<CreativeEngineResult<CompositionRevision>> {
    if (!input.previousRevision) throw new Error('O refinamento exige uma revisão anterior.')
    const effectiveLocks = locksForRefinementIntent(input)
    const result = await this.compositionRequest('/api/creative/refine', {
      ...input,
      locks: effectiveLocks,
    })
    const validation = validateLockedCandidate(input.previousRevision, result.output, effectiveLocks)
    if (!validation.valid) {
      throw new Error(`O refinamento violou ${validation.violations.length} invariante(s) protegida(s).`)
    }
    return result
  }

  async analyzeReference(
    input: CreativeEngineInput,
    reference: VisualReference,
  ): Promise<CreativeEngineResult<ReferenceAnalysis>> {
    const [payload] = await this.userReferences({ ...input, references: [reference] })
    const response = await this.request<GatewayResponse<{ analysis: ReferenceAnalysis }>>(
      '/api/creative/reference-analysis',
      { reference: payload },
    )
    this.referenceAnalyses.set(reference.id, response.analysis)
    return { output: response.analysis, metadata: response.metadata }
  }
}
