import type { CompositionRevision } from '../domain/composition'
import type { CompositionElementId, ElementLockId } from '../domain/ids'
import type {
  ElementLock,
  ElementLockSnapshot,
  InvariantValidation,
  InvariantViolation,
  LockScope,
} from '../domain/locks'
import type {
  CompositionElement,
  ImageElement,
  LogoElement,
  PhotoElement,
  ProductElement,
} from '../domain/sceneGraph'
import type { Timestamp } from '../domain/serialization'

type VisualElement = ImageElement | PhotoElement | ProductElement | LogoElement

function isVisualElement(element: CompositionElement): element is VisualElement {
  return (
    element.type === 'image' ||
    element.type === 'photo' ||
    element.type === 'product' ||
    element.type === 'logo'
  )
}

function serialise(value: unknown): string {
  return value === undefined ? 'undefined' : JSON.stringify(value)
}

function valuesMatch(expected: unknown, received: unknown): boolean {
  return serialise(expected) === serialise(received)
}

function partialStyleMatches(
  expected: Record<string, unknown> | undefined,
  received: Record<string, unknown>,
): boolean {
  if (!expected) return true
  return Object.entries(expected).every(([key, value]) => valuesMatch(value, received[key]))
}

function presentationStyle(element: CompositionElement): Record<string, unknown> {
  return {
    rotation: element.rotation,
    opacity: element.opacity,
    visible: element.visible,
  }
}

function styleSnapshot(element: CompositionElement): ElementLockSnapshot['style'] | undefined {
  const presentation = presentationStyle(element)
  if (element.type === 'text') return { ...presentation, ...element.style }
  if (isVisualElement(element)) {
    return {
      ...presentation,
      fit: element.style.fit,
      borderRadius: element.style.borderRadius,
    }
  }
  if (element.type === 'shape' || element.type === 'annotation') {
    return { ...presentation, ...element.style }
  }
  return presentation
}

function styleForComparison(element: CompositionElement): Record<string, unknown> {
  const presentation = presentationStyle(element)
  if (element.type === 'text') return { ...presentation, ...element.style }
  if (isVisualElement(element)) {
    return {
      ...presentation,
      fit: element.style.fit,
      borderRadius: element.style.borderRadius,
    }
  }
  if (element.type === 'shape' || element.type === 'annotation') {
    return { ...presentation, ...element.style }
  }
  return presentation
}

function contentForComparison(element: CompositionElement): string | undefined {
  return element.type === 'text' || element.type === 'annotation' ? element.content : undefined
}

function assetForComparison(element: CompositionElement) {
  return isVisualElement(element) ? element.assetId : undefined
}

function cropForComparison(element: CompositionElement) {
  return isVisualElement(element)
    ? { x: element.style.crop.x, y: element.style.crop.y }
    : undefined
}

function scaleForComparison(element: CompositionElement): number | undefined {
  return isVisualElement(element) ? element.style.crop.zoom : undefined
}

/**
 * Fingerprints are structural, JSON-safe comparisons for the full-element scope.
 * They intentionally do not rely on the scene graph's informational lockState field.
 */
export function fingerprintCompositionElement(element: CompositionElement): string {
  return JSON.stringify(element)
}

export function createLockSnapshot(
  element: CompositionElement,
  scope: LockScope,
): ElementLockSnapshot {
  switch (scope) {
    case 'content':
      return { content: contentForComparison(element) }
    case 'asset':
      return { assetId: assetForComparison(element) }
    case 'position':
      return { position: { x: element.x, y: element.y } }
    case 'dimensions':
      return { dimensions: { width: element.width, height: element.height } }
    case 'crop':
      return isVisualElement(element) ? { crop: { ...element.style.crop } } : {}
    case 'scale':
      return { scale: scaleForComparison(element) }
    case 'style':
      return { style: styleSnapshot(element) }
    case 'element':
      return { elementFingerprint: fingerprintCompositionElement(element) }
  }
}

export type CreateElementLockInput = {
  id: ElementLockId
  compositionId: ElementLock['compositionId']
  revisionId: ElementLock['revisionId']
  element: CompositionElement
  scope: LockScope
  createdAt: Timestamp
}

export function createElementLock({
  id,
  compositionId,
  revisionId,
  element,
  scope,
  createdAt,
}: CreateElementLockInput): ElementLock {
  return {
    id,
    compositionId,
    revisionId,
    elementId: element.id,
    scopes: [scope],
    protectedSnapshot: createLockSnapshot(element, scope),
    createdAt,
  }
}

export function getApplicableLocks(
  baseRevision: CompositionRevision,
  locks: ElementLock[],
): ElementLock[] {
  return locks.filter(
    (lock) =>
      lock.compositionId === baseRevision.compositionId && lock.revisionId === baseRevision.id,
  )
}

/**
 * Carries the immutable snapshots that protected a base revision into its accepted successor.
 * The source locks are retained for historical validation; callers persist these clones with
 * fresh IDs so one lock record never belongs to two revisions.
 */
export function propagateLocksToRevision(
  baseRevision: CompositionRevision,
  nextRevision: CompositionRevision,
  locks: ElementLock[],
  createLockId: () => ElementLockId,
): ElementLock[] {
  if (baseRevision.compositionId !== nextRevision.compositionId) {
    throw new Error('Os bloqueios só podem ser propagados dentro da mesma composição.')
  }

  return getApplicableLocks(baseRevision, locks).map((lock) => ({
    ...lock,
    id: createLockId(),
    revisionId: nextRevision.id,
  }))
}

export function getLockedScopes(
  baseRevision: CompositionRevision,
  locks: ElementLock[],
  elementId: CompositionElementId,
): LockScope[] {
  return [
    ...new Set(
      getApplicableLocks(baseRevision, locks)
        .filter((lock) => lock.elementId === elementId)
        .flatMap((lock) => lock.scopes),
    ),
  ]
}

export function isLockScopeActive(
  scopes: LockScope[],
  scope: LockScope,
): boolean {
  return scopes.includes('element') || scopes.includes(scope)
}

function pushViolation(
  violations: InvariantViolation[],
  elementId: CompositionElementId,
  scope: LockScope,
  expected: unknown,
  received: unknown,
): void {
  violations.push({
    elementId,
    scope,
    expected: serialise(expected),
    received: serialise(received),
  })
}

function validateScope(
  lock: ElementLock,
  scope: LockScope,
  candidate: CompositionElement | undefined,
  violations: InvariantViolation[],
): void {
  if (!candidate) {
    pushViolation(violations, lock.elementId, scope, lock.protectedSnapshot, 'missing')
    return
  }

  switch (scope) {
    case 'content':
      if (!valuesMatch(lock.protectedSnapshot.content, contentForComparison(candidate))) {
        pushViolation(
          violations,
          lock.elementId,
          scope,
          lock.protectedSnapshot.content,
          contentForComparison(candidate),
        )
      }
      return
    case 'asset':
      if (!valuesMatch(lock.protectedSnapshot.assetId, assetForComparison(candidate))) {
        pushViolation(
          violations,
          lock.elementId,
          scope,
          lock.protectedSnapshot.assetId,
          assetForComparison(candidate),
        )
      }
      return
    case 'position': {
      const received = { x: candidate.x, y: candidate.y }
      if (!valuesMatch(lock.protectedSnapshot.position, received)) {
        pushViolation(violations, lock.elementId, scope, lock.protectedSnapshot.position, received)
      }
      return
    }
    case 'dimensions': {
      const received = { width: candidate.width, height: candidate.height }
      if (!valuesMatch(lock.protectedSnapshot.dimensions, received)) {
        pushViolation(violations, lock.elementId, scope, lock.protectedSnapshot.dimensions, received)
      }
      return
    }
    case 'crop': {
      const expected = lock.protectedSnapshot.crop
        ? { x: lock.protectedSnapshot.crop.x, y: lock.protectedSnapshot.crop.y }
        : undefined
      const received = cropForComparison(candidate)
      if (!valuesMatch(expected, received)) {
        pushViolation(violations, lock.elementId, scope, expected, received)
      }
      return
    }
    case 'scale':
      if (!valuesMatch(lock.protectedSnapshot.scale, scaleForComparison(candidate))) {
        pushViolation(
          violations,
          lock.elementId,
          scope,
          lock.protectedSnapshot.scale,
          scaleForComparison(candidate),
        )
      }
      return
    case 'style':
      if (
        !partialStyleMatches(
          lock.protectedSnapshot.style as Record<string, unknown> | undefined,
          styleForComparison(candidate),
        )
      ) {
        pushViolation(
          violations,
          lock.elementId,
          scope,
          lock.protectedSnapshot.style,
          styleForComparison(candidate),
        )
      }
      return
    case 'element':
      if (
        !valuesMatch(
          lock.protectedSnapshot.elementFingerprint,
          fingerprintCompositionElement(candidate),
        )
      ) {
        pushViolation(
          violations,
          lock.elementId,
          scope,
          lock.protectedSnapshot.elementFingerprint,
          fingerprintCompositionElement(candidate),
        )
      }
  }
}

/**
 * Validates a candidate before it can be accepted. The base revision scopes the locks; protected
 * snapshots, rather than a UI boolean, remain the source of truth for invariants.
 */
export function validateLockedCandidate(
  baseRevision: CompositionRevision,
  candidateRevision: CompositionRevision,
  locks: ElementLock[],
  validatedAt: Timestamp = Date.now(),
): InvariantValidation {
  const candidatesById = new Map(
    candidateRevision.elements.map((element) => [element.id, element]),
  )
  const violations: InvariantViolation[] = []

  for (const lock of getApplicableLocks(baseRevision, locks)) {
    const candidate = candidatesById.get(lock.elementId)
    for (const scope of lock.scopes) {
      validateScope(lock, scope, candidate, violations)
    }
  }

  return {
    valid: violations.length === 0,
    violations,
    checkedRevisionId: candidateRevision.id,
    validatedAt,
  }
}

export function validateLockedElements(
  baseRevision: CompositionRevision,
  candidateElements: CompositionElement[],
  locks: ElementLock[],
  validatedAt: Timestamp = Date.now(),
): InvariantValidation {
  return validateLockedCandidate(
    baseRevision,
    { ...baseRevision, elements: candidateElements },
    locks,
    validatedAt,
  )
}
