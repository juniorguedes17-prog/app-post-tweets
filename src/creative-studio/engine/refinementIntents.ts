import type { CreativeEngineInput } from '../domain/creativeEngine'
import type { ElementLockId } from '../domain/ids'
import type { ElementLock, LockScope } from '../domain/locks'
import type { CompositionElement } from '../domain/sceneGraph'
import { createElementLock } from '../locks/lockEngine'

export type RefinementIntent =
  | 'regenerate-layout'
  | 'more-ugc'
  | 'cleaner'
  | 'more-human'
  | 'more-impact'
  | 'change-hierarchy'
  | 'preserve-image'
  | 'preserve-text'

export const REFINEMENT_INTENT_LABELS: Record<RefinementIntent, string> = {
  'regenerate-layout': 'Regenerar layout',
  'more-ugc': 'Mais UGC',
  cleaner: 'Mais clean',
  'more-human': 'Mais humano',
  'more-impact': 'Mais impacto',
  'change-hierarchy': 'Trocar hierarquia',
  'preserve-image': 'Manter imagem',
  'preserve-text': 'Manter texto',
}

function supportsScope(element: CompositionElement, scope: LockScope): boolean {
  if (scope === 'content') return element.type === 'text' || element.type === 'annotation'
  if (scope === 'asset') {
    return ['image', 'photo', 'product', 'logo'].includes(element.type)
  }
  return true
}

export function locksForRefinementIntent(input: CreativeEngineInput): ElementLock[] {
  const revision = input.previousRevision
  if (!revision) return input.locks
  const scope: LockScope | undefined = input.refinementIntent === 'preserve-image'
    ? 'asset'
    : input.refinementIntent === 'preserve-text'
      ? 'content'
      : undefined
  if (!scope) return input.locks

  const existing = new Set(
    input.locks.flatMap((lock) => lock.scopes.map((lockScope) => `${lock.elementId}:${lockScope}`)),
  )
  const intentLocks = revision.elements.flatMap((element) => {
    if (!supportsScope(element, scope) || existing.has(`${element.id}:${scope}`)) return []
    return [createElementLock({
      id: `intent-${scope}-${element.id}` as ElementLockId,
      compositionId: revision.compositionId,
      revisionId: revision.id,
      element,
      scope,
      createdAt: Date.now(),
    })]
  })
  return [...input.locks, ...intentLocks]
}
