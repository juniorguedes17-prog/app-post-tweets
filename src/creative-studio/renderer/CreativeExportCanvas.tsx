import type { CSSProperties } from 'react'
import type { CanvasSpec } from '../domain/canvas'
import type { CreativeAssetId } from '../domain/ids'
import type { CompositionElement } from '../domain/sceneGraph'
import { SceneElementView } from './SceneElementView'
import './creativeExportCanvas.css'

export type CreativeExportCanvasProps = {
  canvas: CanvasSpec
  elements: CompositionElement[]
  resolveAssetUrl: (assetId: CreativeAssetId) => string | undefined
}

/**
 * A non-interactive, 1:1 canvas used solely for DOM-to-PNG export. It shares
 * the SceneElementView primitive with preview, but never includes editor UI.
 */
export function CreativeExportCanvas({
  canvas,
  elements,
  resolveAssetUrl,
}: CreativeExportCanvasProps) {
  const orderedElements = elements
    .map((element, originalIndex) => ({ element, originalIndex }))
    .sort(
      (left, right) =>
        left.element.zIndex - right.element.zIndex || left.originalIndex - right.originalIndex,
    )

  return (
    <div
      className="creative-studio-export-canvas"
      style={{
        width: canvas.width,
        height: canvas.height,
        background: canvas.background,
      }}
      aria-label="Canvas de exportação do Creative Studio"
    >
      {orderedElements.map(({ element }) => {
        if (!element.visible) return null

        const elementStyle: CSSProperties = {
          left: element.x,
          top: element.y,
          width: element.width,
          height: element.height,
          transform: `rotate(${element.rotation}deg)`,
          zIndex: element.zIndex,
          opacity: element.opacity,
        }

        return (
          <div key={element.id} className="creative-studio-export-element" style={elementStyle}>
            <SceneElementView element={element} resolveAssetUrl={resolveAssetUrl} />
          </div>
        )
      })}
    </div>
  )
}
