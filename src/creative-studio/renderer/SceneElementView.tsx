import type { CSSProperties } from 'react'
import type { CreativeAssetId } from '../domain/ids'
import type {
  AnnotationElement,
  CompositionElement,
  ImageElement,
  LogoElement,
  PhotoElement,
  ProductElement,
  ShapeElement,
} from '../domain/sceneGraph'

export type SceneElementViewProps = {
  element: CompositionElement
  resolveAssetUrl?: (assetId: CreativeAssetId) => string | undefined
}

type VisualAssetElement = ImageElement | PhotoElement | ProductElement | LogoElement

function VisualAssetView({
  element,
  resolveAssetUrl,
}: {
  element: VisualAssetElement
  resolveAssetUrl?: SceneElementViewProps['resolveAssetUrl']
}) {
  const source = resolveAssetUrl?.(element.assetId)
  if (!source) {
    return (
      <div className="creative-studio-scene-element__asset-placeholder">
        <span>{element.semanticRole}</span>
        <small>{element.assetId}</small>
      </div>
    )
  }

  const imageStyle: CSSProperties = {
    objectFit: element.style.fit,
    borderRadius: element.style.borderRadius,
    transform: `translate(${element.style.crop.x}px, ${element.style.crop.y}px) scale(${element.style.crop.zoom})`,
  }

  return (
    <div
      className="creative-studio-scene-element__asset-clip"
      style={{ borderRadius: element.style.borderRadius }}
    >
      <img src={source} alt="" draggable={false} style={imageStyle} />
    </div>
  )
}

function ShapeView({ element }: { element: ShapeElement }) {
  const { shape, fill, stroke, strokeWidth = 0 } = element.style
  const style: CSSProperties = {
    background: shape === 'line' ? undefined : fill,
    borderColor: stroke,
    borderStyle: stroke && strokeWidth > 0 ? 'solid' : undefined,
    borderWidth: strokeWidth,
  }

  if (shape === 'circle') style.borderRadius = '50%'
  if (shape === 'blob') style.borderRadius = '44% 56% 62% 38% / 54% 40% 60% 46%'
  if (shape === 'line') {
    style.height = 0
    style.borderWidth = 0
    style.borderTop = `${strokeWidth || 1}px solid ${stroke ?? fill ?? '#050505'}`
  }

  return <div className="creative-studio-scene-element__shape" style={style} />
}

function AnnotationView({ element }: { element: AnnotationElement }) {
  const { kind, color = '#050505', strokeWidth = 2 } = element.style
  const style: CSSProperties = { color, borderColor: color }
  const content =
    element.content ?? (kind === 'arrow' ? '↗' : kind === 'scribble' ? '〰' : '')

  return (
    <div
      className={`creative-studio-scene-element__annotation creative-studio-scene-element__annotation--${kind}`}
      style={{ ...style, borderWidth: strokeWidth }}
    >
      {content}
    </div>
  )
}

export function SceneElementView({ element, resolveAssetUrl }: SceneElementViewProps) {
  switch (element.type) {
    case 'text':
      return (
        <div
          className="creative-studio-scene-element__text"
          style={{
            fontFamily: element.style.fontFamily,
            fontWeight: element.style.fontWeight,
            fontSize: element.style.fontSize,
            lineHeight: element.style.lineHeight,
            letterSpacing: element.style.letterSpacing,
            textAlign: element.style.textAlign,
            color: element.style.color,
          }}
        >
          {element.content}
        </div>
      )
    case 'image':
    case 'photo':
    case 'product':
    case 'logo':
      return <VisualAssetView element={element} resolveAssetUrl={resolveAssetUrl} />
    case 'shape':
      return <ShapeView element={element} />
    case 'annotation':
      return <AnnotationView element={element} />
    case 'group':
      return <div className="creative-studio-scene-element__group" />
  }
}
