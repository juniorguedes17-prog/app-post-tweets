import assert from 'node:assert/strict'
import {
  MAX_CANVAS_TEXT_FONT_SIZE,
  MIN_CANVAS_TEXT_FONT_SIZE,
  normalizeCanvasTextFontSize,
} from '../server/creativeEngine.mjs'

const invalidRoles = ['headline', 'body', 'cta']
for (const role of invalidRoles) {
  assert.throws(
    () => normalizeCanvasTextFontSize(1, role),
    (error) => error?.code === 'invalid_scene_graph_typography' && error?.statusCode === 422,
    `${role} must reject a one-pixel font size`,
  )
}

assert.equal(normalizeCanvasTextFontSize(96, 'headline'), 96)
assert.equal(normalizeCanvasTextFontSize(28, 'body'), 28)
assert.equal(normalizeCanvasTextFontSize(24, 'cta'), 24)
assert.throws(() => normalizeCanvasTextFontSize(MAX_CANVAS_TEXT_FONT_SIZE + 1, 'headline'))
assert.throws(() => normalizeCanvasTextFontSize(MIN_CANVAS_TEXT_FONT_SIZE - 1, 'cta'))

const textAnnotation = {
  id: 'annotation-note',
  type: 'annotation',
  semanticRole: 'annotation',
  content: 'olha isso',
  style: { kind: 'handwritten-text', color: '#7B2CFF', strokeWidth: 2 },
}
assert.equal(textAnnotation.style.kind, 'handwritten-text')
assert.equal('fontSize' in textAnnotation.style, false)

const revision = {
  id: 'revision-typography-harness',
  compositionId: 'composition-typography-harness',
  revisionNumber: 1,
  parentRevisionId: 'revision-base',
  origin: 'generation',
  elements: [
    {
      id: 'element-headline', type: 'text', semanticRole: 'headline',
      x: 48, y: 72, width: 900, height: 220, rotation: 0, zIndex: 2, opacity: 1, visible: true, lockState: 'unlocked',
      content: 'Headline', style: { fontFamily: 'Montserrat', fontWeight: 700, fontSize: normalizeCanvasTextFontSize(96, 'headline'), lineHeight: 1.1, letterSpacing: -0.02, textAlign: 'left', color: '#050505' },
    },
    textAnnotation,
  ],
}
assert.doesNotThrow(() => JSON.stringify(revision))
console.log('scene-graph typography harness passed')
