import { useId } from 'react'
import type { ColorPalette } from '../domain/colorPalette'
import type { CreativeAsset } from '../domain/creativeAsset'
import type {
  AnnotationElement,
  CompositionElement,
  ImageElement,
  LogoElement,
  PhotoElement,
  ProductElement,
  ShapeElement,
  TextElement,
} from '../domain/sceneGraph'

export type ElementInspectorProps = {
  element?: CompositionElement
  assets: CreativeAsset[]
  fontFamilies: string[]
  palette?: ColorPalette
  onChange: (element: CompositionElement) => void
}

type VisualElement = ImageElement | PhotoElement | ProductElement | LogoElement

function isVisualElement(element: CompositionElement): element is VisualElement {
  return (
    element.type === 'image' ||
    element.type === 'photo' ||
    element.type === 'product' ||
    element.type === 'logo'
  )
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
}) {
  return (
    <label className="creative-studio-inspector__field">
      <span>{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => {
          const next = event.currentTarget.valueAsNumber
          if (Number.isFinite(next)) onChange(next)
        }}
      />
    </label>
  )
}

function ColorField({
  label,
  value,
  paletteColors,
  onChange,
}: {
  label: string
  value?: string
  paletteColors: string[]
  onChange: (value: string) => void
}) {
  const inputValue = /^#[0-9a-f]{6}$/i.test(value ?? '') ? value : '#050505'
  return (
    <div className="creative-studio-inspector__field creative-studio-inspector__field--color">
      <span>{label}</span>
      <div className="creative-studio-inspector__color-inputs">
        <input
          type="color"
          value={inputValue}
          aria-label={`${label} color picker`}
          onChange={(event) => onChange(event.currentTarget.value)}
        />
        <input
          type="text"
          value={value ?? ''}
          aria-label={`${label} color value`}
          onChange={(event) => onChange(event.currentTarget.value)}
        />
      </div>
      {paletteColors.length > 0 ? (
        <div className="creative-studio-inspector__swatches" aria-label="Brand and project colors">
          {paletteColors.map((color) => (
            <button
              key={color}
              type="button"
              title={color}
              aria-label={`Use color ${color}`}
              style={{ backgroundColor: color }}
              onClick={() => onChange(color)}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function TextInspector({
  element,
  fontFamilies,
  paletteColors,
  onChange,
}: {
  element: TextElement
  fontFamilies: string[]
  paletteColors: string[]
  onChange: ElementInspectorProps['onChange']
}) {
  const fontListId = useId()
  const updateStyle = (patch: Partial<TextElement['style']>) =>
    onChange({ ...element, style: { ...element.style, ...patch } })

  return (
    <>
      <label className="creative-studio-inspector__field">
        <span>Content</span>
        <textarea
          value={element.content}
          rows={4}
          onChange={(event) => onChange({ ...element, content: event.currentTarget.value })}
        />
      </label>
      <label className="creative-studio-inspector__field">
        <span>Font family</span>
        <input
          type="text"
          list={fontListId}
          value={element.style.fontFamily}
          onChange={(event) => updateStyle({ fontFamily: event.currentTarget.value })}
        />
        <datalist id={fontListId}>
          {fontFamilies.map((fontFamily) => (
            <option key={fontFamily} value={fontFamily} />
          ))}
        </datalist>
      </label>
      <div className="creative-studio-inspector__grid">
        <NumberField
          label="Weight"
          value={element.style.fontWeight}
          min={100}
          max={900}
          step={100}
          onChange={(fontWeight) => updateStyle({ fontWeight })}
        />
        <NumberField
          label="Size"
          value={element.style.fontSize}
          min={1}
          onChange={(fontSize) => updateStyle({ fontSize })}
        />
        <NumberField
          label="Line height"
          value={element.style.lineHeight}
          min={0.1}
          step={0.05}
          onChange={(lineHeight) => updateStyle({ lineHeight })}
        />
        <NumberField
          label="Letter spacing"
          value={element.style.letterSpacing}
          step={0.1}
          onChange={(letterSpacing) => updateStyle({ letterSpacing })}
        />
      </div>
      <label className="creative-studio-inspector__field">
        <span>Alignment</span>
        <select
          value={element.style.textAlign}
          onChange={(event) =>
            updateStyle({ textAlign: event.currentTarget.value as TextElement['style']['textAlign'] })
          }
        >
          <option value="left">Left</option>
          <option value="center">Center</option>
          <option value="right">Right</option>
        </select>
      </label>
      <ColorField
        label="Text"
        value={element.style.color}
        paletteColors={paletteColors}
        onChange={(color) => updateStyle({ color })}
      />
    </>
  )
}

function VisualInspector({
  element,
  assets,
  onChange,
}: {
  element: VisualElement
  assets: CreativeAsset[]
  onChange: ElementInspectorProps['onChange']
}) {
  const updateStyle = (patch: Partial<VisualElement['style']>) =>
    onChange({ ...element, style: { ...element.style, ...patch } })

  return (
    <>
      <label className="creative-studio-inspector__field">
        <span>Asset</span>
        <select
          value={element.assetId}
          onChange={(event) =>
            onChange({ ...element, assetId: event.currentTarget.value as VisualElement['assetId'] })
          }
        >
          {!assets.some((asset) => asset.id === element.assetId) ? (
            <option value={element.assetId}>{element.assetId}</option>
          ) : null}
          {assets.map((asset) => (
            <option key={asset.id} value={asset.id}>
              {asset.metadata?.originalFileName ?? asset.id}
            </option>
          ))}
        </select>
      </label>
      <label className="creative-studio-inspector__field">
        <span>Fit</span>
        <select
          value={element.style.fit}
          onChange={(event) =>
            updateStyle({ fit: event.currentTarget.value as VisualElement['style']['fit'] })
          }
        >
          <option value="cover">Cover</option>
          <option value="contain">Contain</option>
          <option value="fill">Fill</option>
        </select>
      </label>
      <div className="creative-studio-inspector__grid">
        <NumberField
          label="Crop X"
          value={element.style.crop.x}
          onChange={(x) => updateStyle({ crop: { ...element.style.crop, x } })}
        />
        <NumberField
          label="Crop Y"
          value={element.style.crop.y}
          onChange={(y) => updateStyle({ crop: { ...element.style.crop, y } })}
        />
        <NumberField
          label="Zoom"
          value={element.style.crop.zoom}
          min={0.01}
          step={0.05}
          onChange={(zoom) => updateStyle({ crop: { ...element.style.crop, zoom } })}
        />
        <NumberField
          label="Radius"
          value={element.style.borderRadius}
          min={0}
          onChange={(borderRadius) => updateStyle({ borderRadius })}
        />
      </div>
    </>
  )
}

function ShapeInspector({
  element,
  paletteColors,
  onChange,
}: {
  element: ShapeElement
  paletteColors: string[]
  onChange: ElementInspectorProps['onChange']
}) {
  const updateStyle = (patch: Partial<ShapeElement['style']>) =>
    onChange({ ...element, style: { ...element.style, ...patch } })
  return (
    <>
      <label className="creative-studio-inspector__field">
        <span>Shape</span>
        <select
          value={element.style.shape}
          onChange={(event) =>
            updateStyle({ shape: event.currentTarget.value as ShapeElement['style']['shape'] })
          }
        >
          <option value="rectangle">Rectangle</option>
          <option value="circle">Circle</option>
          <option value="line">Line</option>
          <option value="blob">Blob</option>
        </select>
      </label>
      <ColorField
        label="Fill"
        value={element.style.fill}
        paletteColors={paletteColors}
        onChange={(fill) => updateStyle({ fill })}
      />
      <ColorField
        label="Stroke"
        value={element.style.stroke}
        paletteColors={paletteColors}
        onChange={(stroke) => updateStyle({ stroke })}
      />
      <NumberField
        label="Stroke width"
        value={element.style.strokeWidth ?? 0}
        min={0}
        onChange={(strokeWidth) => updateStyle({ strokeWidth })}
      />
    </>
  )
}

function AnnotationInspector({
  element,
  paletteColors,
  onChange,
}: {
  element: AnnotationElement
  paletteColors: string[]
  onChange: ElementInspectorProps['onChange']
}) {
  const updateStyle = (patch: Partial<AnnotationElement['style']>) =>
    onChange({ ...element, style: { ...element.style, ...patch } })
  return (
    <>
      <ColorField
        label="Annotation"
        value={element.style.color}
        paletteColors={paletteColors}
        onChange={(color) => updateStyle({ color })}
      />
      <NumberField
        label="Stroke width"
        value={element.style.strokeWidth ?? 0}
        min={0}
        onChange={(strokeWidth) => updateStyle({ strokeWidth })}
      />
    </>
  )
}

export function ElementInspector({
  element,
  assets,
  fontFamilies,
  palette,
  onChange,
}: ElementInspectorProps) {
  const paletteColors = palette
    ? [
        ...new Set([
          palette.primary,
          palette.secondary,
          palette.accent,
          palette.background,
          palette.text,
          palette.muted,
          ...Object.values(palette.custom),
        ]),
      ]
    : []

  if (!element) {
    return (
      <aside className="creative-studio-inspector">
        <h2>Inspector</h2>
        <p className="creative-studio-inspector__empty">Select an element on the canvas.</p>
      </aside>
    )
  }

  const updateBase = (patch: Partial<CompositionElement>) =>
    onChange({ ...element, ...patch } as CompositionElement)

  return (
    <aside className="creative-studio-inspector">
      <div className="creative-studio-inspector__heading">
        <div>
          <span>{element.type}</span>
          <h2>{element.semanticRole}</h2>
        </div>
        <code>{element.id}</code>
      </div>

      <section className="creative-studio-inspector__section">
        <h3>Geometry</h3>
        <div className="creative-studio-inspector__grid">
          <NumberField label="X" value={element.x} onChange={(x) => updateBase({ x })} />
          <NumberField label="Y" value={element.y} onChange={(y) => updateBase({ y })} />
          <NumberField
            label="Width"
            value={element.width}
            min={1}
            onChange={(width) => updateBase({ width: Math.max(1, width) })}
          />
          <NumberField
            label="Height"
            value={element.height}
            min={1}
            onChange={(height) => updateBase({ height: Math.max(1, height) })}
          />
          <NumberField
            label="Rotation"
            value={element.rotation}
            onChange={(rotation) => updateBase({ rotation })}
          />
          <NumberField
            label="Opacity"
            value={element.opacity}
            min={0}
            max={1}
            step={0.05}
            onChange={(opacity) => updateBase({ opacity: Math.min(1, Math.max(0, opacity)) })}
          />
        </div>
      </section>

      <section className="creative-studio-inspector__section">
        <h3>Element</h3>
        {element.type === 'text' ? (
          <TextInspector
            element={element}
            fontFamilies={fontFamilies}
            paletteColors={paletteColors}
            onChange={onChange}
          />
        ) : null}
        {isVisualElement(element) ? (
          <VisualInspector element={element} assets={assets} onChange={onChange} />
        ) : null}
        {element.type === 'shape' ? (
          <ShapeInspector
            element={element}
            paletteColors={paletteColors}
            onChange={onChange}
          />
        ) : null}
        {element.type === 'annotation' ? (
          <AnnotationInspector
            element={element}
            paletteColors={paletteColors}
            onChange={onChange}
          />
        ) : null}
        {element.type === 'group' ? (
          <p className="creative-studio-inspector__note">
            Group with {element.children.length} referenced element(s).
          </p>
        ) : null}
      </section>
    </aside>
  )
}
