import assert from 'node:assert/strict'
import {
  createElementLock,
  getLockedScopes,
  propagateLocksToRevision,
  validateLockedCandidate,
} from '../src/creative-studio/locks/lockEngine.ts'

const base = {
  id: 'revision-2',
  compositionId: 'composition-locks',
  revisionNumber: 2,
  origin: 'manual-edit',
  createdAt: 1,
  elements: [
    {
      id: 'headline', type: 'text', semanticRole: 'headline',
      x: 100, y: 120, width: 800, height: 180, rotation: 0, zIndex: 2,
      opacity: 1, visible: true, lockState: 'unlocked', content: 'Locked headline',
      style: { fontFamily: 'Montserrat', fontWeight: 700, fontSize: 72, lineHeight: 1.1, letterSpacing: 0, textAlign: 'left', color: '#050505' },
    },
    {
      id: 'photo', type: 'photo', semanticRole: 'photo',
      x: 0, y: 0, width: 1080, height: 1350, rotation: 0, zIndex: 1,
      opacity: 1, visible: true, lockState: 'unlocked', assetId: 'asset-photo',
      style: { fit: 'cover', crop: { x: 0.5, y: 0.5, zoom: 1.1 }, borderRadius: 0 },
    },
    {
      id: 'logo', type: 'logo', semanticRole: 'logo',
      x: 900, y: 1200, width: 80, height: 80, rotation: 0, zIndex: 3,
      opacity: 1, visible: true, lockState: 'unlocked', assetId: 'asset-logo',
      style: { fit: 'contain', crop: { x: 0, y: 0, zoom: 1 }, borderRadius: 0 },
    },
    {
      id: 'cta', type: 'text', semanticRole: 'cta',
      x: 100, y: 1100, width: 400, height: 60, rotation: 0, zIndex: 2,
      opacity: 1, visible: true, lockState: 'unlocked', content: 'Leia a legenda',
      style: { fontFamily: 'Inter', fontWeight: 500, fontSize: 28, lineHeight: 1.2, letterSpacing: 0, textAlign: 'left', color: '#050505' },
    },
  ],
} as const

const byId = new Map(base.elements.map((element) => [element.id, element]))
let id = 0
const createLock = (elementId: keyof typeof byId extends never ? never : string, scope: Parameters<typeof createElementLock>[0]['scope']) =>
  createElementLock({
    id: `lock-${++id}` as never,
    compositionId: base.compositionId as never,
    revisionId: base.id as never,
    element: byId.get(elementId) as never,
    scope,
    createdAt: 2,
  })

const baseLocks = [
  createLock('headline', 'content'),
  createLock('headline', 'position'),
  createLock('photo', 'asset'),
  createLock('photo', 'crop'),
  createLock('logo', 'element'),
  createLock('cta', 'content'),
]

const revision3 = {
  ...base,
  id: 'revision-3',
  revisionNumber: 3,
  parentRevisionId: base.id,
  origin: 'refinement',
  createdAt: 3,
  elements: base.elements.map((element) => element.id === 'headline'
    ? { ...element, width: 760, style: { ...element.style, fontSize: 64 } }
    : element),
}

assert.equal(validateLockedCandidate(base as never, revision3 as never, baseLocks).valid, true)
const propagated = propagateLocksToRevision(
  base as never,
  revision3 as never,
  baseLocks,
  () => `propagated-${++id}` as never,
)

assert.equal(propagated.length, baseLocks.length)
assert.ok(propagated.every((lock) => lock.revisionId === revision3.id))
assert.deepEqual(propagated.map((lock) => lock.scopes), baseLocks.map((lock) => lock.scopes))
assert.ok(propagated.every((lock, index) => lock.id !== baseLocks[index]?.id))
assert.deepEqual(getLockedScopes(revision3 as never, propagated, 'headline' as never).sort(), ['content', 'position'])

const prohibitedEdit = {
  ...revision3,
  elements: revision3.elements.map((element) => element.id === 'headline'
    ? { ...element, content: 'Changed after refinement' }
    : element),
}
assert.equal(validateLockedCandidate(revision3 as never, prohibitedEdit as never, propagated).valid, false)
assert.doesNotThrow(() => JSON.stringify({ base, revision3, propagated }))
console.log('lock propagation harness passed')
