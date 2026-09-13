import { useEffect, useMemo, useState } from 'react'
import type { BrandOverrides, BrandProfile } from '../domain/brandProfile'
import type { CanvasSpec } from '../domain/canvas'
import type { CreativeAsset } from '../domain/creativeAsset'
import type { CompositionRevision } from '../domain/composition'
import type { CreativeAssetId } from '../domain/ids'
import type { CompositionElement } from '../domain/sceneGraph'
import { CreativeCanvas } from '../renderer/CreativeCanvas'
import { resolveEditorPalette, resolveEditorTypography } from './brandContext'
import { ElementInspector } from './ElementInspector'
import type { ElementIdFactory } from './editorOperations'
import { useCreativeEditor } from './useCreativeEditor'
import './creativeStudioEditor.css'

export type CreativeStudioEditorProps = {
  revision: CompositionRevision
  canvas: CanvasSpec
  assets?: CreativeAsset[]
  brandProfile?: BrandProfile
  brandOverrides?: BrandOverrides
  resolveAssetUrl?: (assetId: CreativeAssetId) => string | undefined
  createElementId?: ElementIdFactory
  onWorkingElementsChange?: (elements: CompositionElement[]) => void
}

export function CreativeStudioEditor({
  revision,
  canvas,
  assets = [],
  brandProfile,
  brandOverrides,
  resolveAssetUrl,
  createElementId,
  onWorkingElementsChange,
}: CreativeStudioEditorProps) {
  const editor = useCreativeEditor({
    revision,
    ...(createElementId ? { createElementId } : {}),
    ...(onWorkingElementsChange ? { onWorkingElementsChange } : {}),
  })
  const [mobileInspectorOpen, setMobileInspectorOpen] = useState(false)

  useEffect(() => {
    if (!editor.selectedElement) setMobileInspectorOpen(false)
  }, [editor.selectedElement])

  const palette = useMemo(
    () => resolveEditorPalette(brandProfile, brandOverrides),
    [brandOverrides, brandProfile],
  )
  const typography = useMemo(
    () => resolveEditorTypography(brandProfile, brandOverrides),
    [brandOverrides, brandProfile],
  )
  const fontFamilies = useMemo(
    () =>
      typography
        ? [
            ...new Set([
              ...typography.allowedFonts,
              typography.display.fontFamily,
              typography.body.fontFamily,
              typography.caption.fontFamily,
            ]),
          ]
        : [],
    [typography],
  )

  return (
    <section className="creative-studio-editor" aria-label="Creative Studio editor">
      <header className="creative-studio-editor__toolbar">
        <div className="creative-studio-editor__revision">
          <strong>Composition</strong>
          <span>Revision {revision.revisionNumber}</span>
        </div>
        <div className="creative-studio-editor__actions" aria-label="History actions">
          <button type="button" disabled={!editor.canUndo} onClick={editor.undo}>
            Undo
          </button>
          <button type="button" disabled={!editor.canRedo} onClick={editor.redo}>
            Redo
          </button>
        </div>
        <div className="creative-studio-editor__actions" aria-label="Element actions">
          <button
            type="button"
            disabled={!editor.selectedElement}
            onClick={() => editor.moveSelectedLayer('backward')}
          >
            Send backward
          </button>
          <button
            type="button"
            disabled={!editor.selectedElement}
            onClick={() => editor.moveSelectedLayer('forward')}
          >
            Bring forward
          </button>
          <button
            type="button"
            disabled={!editor.selectedElement}
            onClick={editor.duplicateSelected}
          >
            Duplicate
          </button>
          <button
            type="button"
            disabled={!editor.selectedElement}
            onClick={editor.deleteSelected}
          >
            Delete
          </button>
        </div>
      </header>

      <div className="creative-studio-editor__workspace">
        <main className="creative-studio-editor__stage">
          <CreativeCanvas
            canvas={canvas}
            elements={editor.elements}
            selectedElementId={editor.selectedElementId}
            resolveAssetUrl={resolveAssetUrl}
            onSelectElement={editor.selectElement}
            onPreviewElements={editor.previewElements}
            onFinalizeInteraction={editor.finalizePreview}
          />
        </main>
        {editor.selectedElement ? (
          <button
            type="button"
            className="creative-studio-editor__mobile-inspector-toggle"
            onClick={() => setMobileInspectorOpen(true)}
          >
            Edit {editor.selectedElement.semanticRole}
          </button>
        ) : null}
        {mobileInspectorOpen && editor.selectedElement ? (
          <button
            type="button"
            className="creative-studio-editor__mobile-sheet-backdrop"
            aria-label="Close element inspector"
            onClick={() => setMobileInspectorOpen(false)}
          />
        ) : null}
        <div
          className={
            mobileInspectorOpen
              ? 'creative-studio-editor__inspector-shell creative-studio-editor__inspector-shell--open'
              : 'creative-studio-editor__inspector-shell'
          }
        >
          <button
            type="button"
            className="creative-studio-editor__mobile-sheet-close"
            onClick={() => setMobileInspectorOpen(false)}
          >
            Done
          </button>
          <ElementInspector
            element={editor.selectedElement}
            assets={assets}
            fontFamilies={fontFamilies}
            palette={palette}
            onChange={editor.updateElement}
          />
        </div>
      </div>
    </section>
  )
}
