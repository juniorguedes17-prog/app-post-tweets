import type { CompositionElementId } from '../domain/ids'
import type { CompositionElement, GroupElement } from '../domain/sceneGraph'

export type ElementIdFactory = () => CompositionElementId
export type LayerDirection = 'forward' | 'backward'

export type DuplicateElementResult = {
  elements: CompositionElement[]
  duplicatedElementId?: CompositionElementId
}

export function cloneCompositionElements(elements: CompositionElement[]): CompositionElement[] {
  return JSON.parse(JSON.stringify(elements)) as CompositionElement[]
}

export function replaceCompositionElement(
  elements: CompositionElement[],
  replacement: CompositionElement,
): CompositionElement[] {
  return elements.map((element) =>
    element.id === replacement.id ? cloneCompositionElements([replacement])[0] : element,
  )
}

function collectGroupDescendants(
  elementsById: Map<CompositionElementId, CompositionElement>,
  elementId: CompositionElementId,
  visited = new Set<CompositionElementId>(),
): Set<CompositionElementId> {
  if (visited.has(elementId)) return visited
  visited.add(elementId)

  const element = elementsById.get(elementId)
  if (element?.type === 'group') {
    for (const childId of element.children) {
      if (elementsById.has(childId)) collectGroupDescendants(elementsById, childId, visited)
    }
  }
  return visited
}

export function moveCompositionElement(
  elements: CompositionElement[],
  elementId: CompositionElementId,
  deltaX: number,
  deltaY: number,
): CompositionElement[] {
  const elementsById = new Map(elements.map((element) => [element.id, element]))
  const movedIds = collectGroupDescendants(elementsById, elementId)
  return elements.map((element) =>
    movedIds.has(element.id)
      ? { ...element, x: element.x + deltaX, y: element.y + deltaY }
      : element,
  )
}

export function resizeCompositionElement(
  elements: CompositionElement[],
  elementId: CompositionElementId,
  width: number,
  height: number,
): CompositionElement[] {
  return elements.map((element) =>
    element.id === elementId
      ? { ...element, width: Math.max(1, width), height: Math.max(1, height) }
      : element,
  )
}

export function deleteCompositionElement(
  elements: CompositionElement[],
  elementId: CompositionElementId,
): CompositionElement[] {
  return elements
    .filter((element) => element.id !== elementId)
    .map((element) =>
      element.type === 'group' && element.children.includes(elementId)
        ? { ...element, children: element.children.filter((childId) => childId !== elementId) }
        : element,
    )
}

export function duplicateCompositionElement(
  elements: CompositionElement[],
  elementId: CompositionElementId,
  createId: ElementIdFactory,
  offset = 16,
): DuplicateElementResult {
  const elementsById = new Map(elements.map((element) => [element.id, element]))
  if (!elementsById.has(elementId)) return { elements }

  const idMap = new Map<CompositionElementId, CompositionElementId>()
  const duplicated: CompositionElement[] = []
  const visiting = new Set<CompositionElementId>()

  const duplicateById = (sourceId: CompositionElementId): CompositionElementId | undefined => {
    const mappedId = idMap.get(sourceId)
    if (mappedId) return mappedId
    if (visiting.has(sourceId)) return undefined

    const source = elementsById.get(sourceId)
    if (!source) return undefined

    visiting.add(sourceId)
    const duplicatedId = createId()
    idMap.set(sourceId, duplicatedId)

    const clone = cloneCompositionElements([source])[0]
    const base = {
      ...clone,
      id: duplicatedId,
      x: clone.x + offset,
      y: clone.y + offset,
    }

    if (clone.type === 'group') {
      const children = clone.children
        .map((childId) => duplicateById(childId))
        .filter((childId): childId is CompositionElementId => Boolean(childId))
      duplicated.push({ ...base, type: 'group', children } satisfies GroupElement)
    } else {
      duplicated.push(base)
    }

    visiting.delete(sourceId)
    return duplicatedId
  }

  const duplicatedElementId = duplicateById(elementId)
  return {
    elements: [...elements, ...duplicated],
    ...(duplicatedElementId ? { duplicatedElementId } : {}),
  }
}

export function moveElementLayer(
  elements: CompositionElement[],
  elementId: CompositionElementId,
  direction: LayerDirection,
): CompositionElement[] {
  const ordered = elements
    .map((element, originalIndex) => ({ element, originalIndex }))
    .sort(
      (left, right) =>
        left.element.zIndex - right.element.zIndex || left.originalIndex - right.originalIndex,
    )

  const currentIndex = ordered.findIndex(({ element }) => element.id === elementId)
  if (currentIndex < 0) return elements

  const targetIndex = direction === 'forward' ? currentIndex + 1 : currentIndex - 1
  if (targetIndex < 0 || targetIndex >= ordered.length) return elements

  const current = ordered[currentIndex]
  ordered[currentIndex] = ordered[targetIndex]
  ordered[targetIndex] = current

  const layerById = new Map(
    ordered.map(({ element }, index) => [element.id, index] as const),
  )
  return elements.map((element) => ({ ...element, zIndex: layerById.get(element.id) ?? element.zIndex }))
}
