import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import type { CanvasSpec } from '../domain/canvas'
import type { CreativeAssetId, CompositionElementId } from '../domain/ids'
import type { CompositionElement } from '../domain/sceneGraph'
import type { LockScope } from '../domain/locks'
import {
  cloneCompositionElements,
  moveCompositionElement,
  resizeCompositionElement,
} from '../editor/editorOperations'
import { SceneElementView } from './SceneElementView'

export type CreativeCanvasProps = {
  canvas: CanvasSpec
  elements: CompositionElement[]
  selectedElementId?: CompositionElementId
  resolveAssetUrl?: (assetId: CreativeAssetId) => string | undefined
  onSelectElement: (elementId?: CompositionElementId) => void
  onPreviewElements: (elements: CompositionElement[]) => void
  onFinalizeInteraction: (before: CompositionElement[]) => void
  isElementScopeLocked?: (
    elementId: CompositionElementId,
    scope: Extract<LockScope, 'position' | 'dimensions'>,
  ) => boolean
}

type CanvasInteraction = {
  pointerId: number
  mode: 'move' | 'resize'
  elementId: CompositionElementId
  startClientX: number
  startClientY: number
  startWidth: number
  startHeight: number
  before: CompositionElement[]
}

export function CreativeCanvas({
  canvas,
  elements,
  selectedElementId,
  resolveAssetUrl,
  onSelectElement,
  onPreviewElements,
  onFinalizeInteraction,
  isElementScopeLocked,
}: CreativeCanvasProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const interactionRef = useRef<CanvasInteraction | undefined>(undefined)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    const updateScale = () => {
      const availableWidth = viewport.clientWidth
      if (availableWidth > 0) setScale(availableWidth / canvas.width)
    }
    updateScale()

    const observer = new ResizeObserver(updateScale)
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [canvas.width])

  const beginInteraction = (
    event: ReactPointerEvent<HTMLElement>,
    element: CompositionElement,
    mode: CanvasInteraction['mode'],
  ) => {
    if (event.button !== 0) return
    event.stopPropagation()
    onSelectElement(element.id)
    const scope = mode === 'move' ? 'position' : 'dimensions'
    if (isElementScopeLocked?.(element.id, scope)) return
    event.currentTarget.setPointerCapture(event.pointerId)
    interactionRef.current = {
      pointerId: event.pointerId,
      mode,
      elementId: element.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startWidth: element.width,
      startHeight: element.height,
      before: cloneCompositionElements(elements),
    }
  }

  const updateInteraction = (event: ReactPointerEvent<HTMLElement>) => {
    const interaction = interactionRef.current
    if (!interaction || interaction.pointerId !== event.pointerId) return

    const deltaX = (event.clientX - interaction.startClientX) / scale
    const deltaY = (event.clientY - interaction.startClientY) / scale
    const next =
      interaction.mode === 'move'
        ? moveCompositionElement(interaction.before, interaction.elementId, deltaX, deltaY)
        : resizeCompositionElement(
            interaction.before,
            interaction.elementId,
            interaction.startWidth + deltaX,
            interaction.startHeight + deltaY,
          )
    onPreviewElements(next)
  }

  const finishInteraction = (event: ReactPointerEvent<HTMLElement>) => {
    const interaction = interactionRef.current
    if (!interaction || interaction.pointerId !== event.pointerId) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    interactionRef.current = undefined
    onFinalizeInteraction(interaction.before)
  }

  const canvasStyle: CSSProperties = {
    width: canvas.width,
    height: canvas.height,
    background: canvas.background,
    transform: `scale(${scale})`,
    '--creative-studio-inverse-scale': String(1 / scale),
  } as CSSProperties

  const orderedElements = elements
    .map((element, originalIndex) => ({ element, originalIndex }))
    .sort(
      (left, right) =>
        left.element.zIndex - right.element.zIndex || left.originalIndex - right.originalIndex,
    )

  return (
    <div
      ref={viewportRef}
      className="creative-studio-canvas-viewport"
      style={{ height: canvas.height * scale }}
    >
      <div
        className="creative-studio-canvas"
        style={canvasStyle}
        onPointerDown={(event) => {
          if (event.target === event.currentTarget) onSelectElement(undefined)
        }}
      >
        {orderedElements.map(({ element }) => {
          if (!element.visible) return null
          const selected = element.id === selectedElementId
          return (
            <div
              key={element.id}
              className={
                selected
                  ? 'creative-studio-scene-element creative-studio-scene-element--selected'
                  : 'creative-studio-scene-element'
              }
              style={{
                left: element.x,
                top: element.y,
                width: element.width,
                height: element.height,
                transform: `rotate(${element.rotation}deg)`,
                zIndex: element.zIndex,
                opacity: element.opacity,
              }}
              role="button"
              tabIndex={0}
              aria-label={`Select ${element.semanticRole} element`}
              onPointerDown={(event) => beginInteraction(event, element, 'move')}
              onPointerMove={updateInteraction}
              onPointerUp={finishInteraction}
              onPointerCancel={finishInteraction}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') onSelectElement(element.id)
              }}
            >
              <SceneElementView element={element} resolveAssetUrl={resolveAssetUrl} />
              {selected ? (
                <button
                  type="button"
                  className="creative-studio-scene-element__resize-handle"
                  aria-label="Resize selected element"
                  onPointerDown={(event) => beginInteraction(event, element, 'resize')}
                  onPointerMove={updateInteraction}
                  onPointerUp={finishInteraction}
                  onPointerCancel={finishInteraction}
                />
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
