import type { CreativeAsset } from '../domain/creativeAsset'
import type { CompositionRevision } from '../domain/composition'
import type { CompositionElement } from '../domain/sceneGraph'

const visualTypes = new Set(['image', 'photo', 'product', 'logo'])

function finite(value: number): boolean {
  return Number.isFinite(value)
}

function assertElement(element: CompositionElement, assetIds: Set<string>): void {
  if (!element.id || !element.type || !element.semanticRole) {
    throw new Error('O Creative Engine retornou um elemento sem identidade ou semântica estável.')
  }
  if (
    !finite(element.x) || !finite(element.y) || !finite(element.width) ||
    !finite(element.height) || element.width <= 0 || element.height <= 0 ||
    !finite(element.rotation) || !finite(element.zIndex) ||
    !finite(element.opacity) || element.opacity < 0 || element.opacity > 1
  ) {
    throw new Error(`O Creative Engine retornou geometria inválida para o elemento "${element.id}".`)
  }
  if (element.type === 'text') {
    const style = element.style
    if (
      typeof element.content !== 'string' || !style.fontFamily ||
      !finite(style.fontWeight) || !finite(style.fontSize) || style.fontSize <= 0 ||
      !finite(style.lineHeight) || !finite(style.letterSpacing) || !style.color
    ) {
      throw new Error(`O Creative Engine retornou estilo tipográfico inválido para "${element.id}".`)
    }
  }
  if (visualTypes.has(element.type)) {
    const visual = element as Extract<CompositionElement, { assetId: unknown }>
    if (!assetIds.has(visual.assetId)) {
      throw new Error(`O Creative Engine referenciou a imagem desconhecida "${visual.assetId}".`)
    }
    if (!finite(visual.style.crop.x) || !finite(visual.style.crop.y) || visual.style.crop.zoom <= 0) {
      throw new Error(`O Creative Engine retornou recorte inválido para "${element.id}".`)
    }
  }
}

export function assertValidEngineRevision(
  revision: CompositionRevision,
  baseRevision: CompositionRevision,
  assets: CreativeAsset[],
): void {
  if (
    revision.compositionId !== baseRevision.compositionId ||
    revision.parentRevisionId !== baseRevision.id ||
    revision.revisionNumber !== baseRevision.revisionNumber + 1 ||
    revision.id === baseRevision.id ||
    revision.elements.length === 0
  ) {
    throw new Error('O Creative Engine retornou um histórico de revisão inválido.')
  }
  const ids = new Set<string>()
  const assetIds = new Set(assets.map((asset) => String(asset.id)))
  for (const element of revision.elements) {
    if (ids.has(element.id)) throw new Error(`ID de elemento duplicado no canvas: "${element.id}".`)
    ids.add(element.id)
    assertElement(element, assetIds)
  }
}
