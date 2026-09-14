import { useEffect, useMemo, useState } from 'react'
import type { BrandOverrides, BrandProfile } from '../domain/brandProfile'
import type { CanvasSpec } from '../domain/canvas'
import type { CreativeAsset } from '../domain/creativeAsset'
import type { CompositionRevision } from '../domain/composition'
import type { CreativeAssetId, ElementLockId } from '../domain/ids'
import type { ElementLock, InvariantValidation } from '../domain/locks'
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
  locks?: ElementLock[]
  createLockId?: () => ElementLockId
  onLocksChange?: (locks: ElementLock[]) => void
  onInvariantViolation?: (validation: InvariantValidation) => void
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
  locks,
  createLockId,
  onLocksChange,
  onInvariantViolation,
  onWorkingElementsChange,
}: CreativeStudioEditorProps) {
  const editor = useCreativeEditor({
    revision,
    ...(createElementId ? { createElementId } : {}),
    ...(locks !== undefined ? { locks } : {}),
    ...(createLockId ? { createLockId } : {}),
    ...(onLocksChange ? { onLocksChange } : {}),
    ...(onInvariantViolation ? { onInvariantViolation } : {}),
    ...(onWorkingElementsChange ? { onWorkingElementsChange } : {}),
  })
  const [mobileInspectorOpen, setMobileInspectorOpen] = useState(false)

  useEffect(() => {
    if (!editor.selectedElement) setMobileInspectorOpen(false)
  }, [editor.selectedElement])

  useEffect(() => {
    if (!editor.selectedElementId) return

    const clearSelectionOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') editor.selectElement(undefined)
    }

    document.addEventListener('keydown', clearSelectionOnEscape)
    return () => document.removeEventListener('keydown', clearSelectionOnEscape)
  }, [editor.selectElement, editor.selectedElementId])

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
  const selectedLockedScopes = editor.selectedElement
    ? editor.lockedScopesForElement(editor.selectedElement.id)
    : []
  const selectedElementFullyLocked = selectedLockedScopes.includes('element')
  const selectedElementHasLocks = selectedLockedScopes.length > 0

  return (
    <section className="creative-studio-editor" aria-label="Editor do Creative Studio">
      <header className="creative-studio-editor__toolbar">
        <div className="creative-studio-editor__revision">
          <strong>Composição</strong>
          <span>Revisão {revision.revisionNumber}</span>
        </div>
        <div className="creative-studio-editor__actions" aria-label="Ações de histórico">
          <button type="button" disabled={!editor.canUndo} onClick={editor.undo}>
            Desfazer
          </button>
          <button type="button" disabled={!editor.canRedo} onClick={editor.redo}>
            Refazer
          </button>
        </div>
        <div className="creative-studio-editor__actions" aria-label="Ações do elemento">
          <button
            type="button"
            disabled={!editor.selectedElement || selectedElementFullyLocked}
            onClick={() => editor.moveSelectedLayer('backward')}
          >
            Enviar para trás
          </button>
          <button
            type="button"
            disabled={!editor.selectedElement || selectedElementFullyLocked}
            onClick={() => editor.moveSelectedLayer('forward')}
          >
            Trazer para frente
          </button>
          <button
            type="button"
            disabled={!editor.selectedElement || selectedElementHasLocks}
            onClick={editor.duplicateSelected}
          >
            Duplicar
          </button>
          <button
            type="button"
            disabled={!editor.selectedElement}
            onClick={editor.deleteSelected}
          >
            Excluir
          </button>
        </div>
      </header>
      {!editor.lastInvariantValidation?.valid ? (
        <p className="creative-studio-editor__lock-alert" role="alert">
          Um elemento protegido não pode ser alterado enquanto o bloqueio correspondente estiver ativo.
        </p>
      ) : null}

      <div className="creative-studio-editor__workspace">
        <main
          className="creative-studio-editor__stage"
          onPointerDown={(event) => {
            const target = event.target
            if (target instanceof Element && !target.closest('.creative-studio-canvas')) {
              editor.selectElement(undefined)
            }
          }}
        >
          <CreativeCanvas
            canvas={canvas}
            elements={editor.elements}
            selectedElementId={editor.selectedElementId}
            resolveAssetUrl={resolveAssetUrl}
            onSelectElement={editor.selectElement}
            onPreviewElements={editor.previewElements}
            onFinalizeInteraction={editor.finalizePreview}
            isElementScopeLocked={editor.isElementScopeLocked}
          />
        </main>
        {editor.selectedElement ? (
          <button
            type="button"
            className="creative-studio-editor__mobile-inspector-toggle"
            onClick={() => setMobileInspectorOpen(true)}
          >
            Editar elemento
          </button>
        ) : null}
        {mobileInspectorOpen && editor.selectedElement ? (
          <button
            type="button"
            className="creative-studio-editor__mobile-sheet-backdrop"
            aria-label="Fechar inspetor do elemento"
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
            Concluir
          </button>
          <ElementInspector
            element={editor.selectedElement}
            assets={assets}
            fontFamilies={fontFamilies}
            palette={palette}
            lockedScopes={selectedLockedScopes}
            onToggleLock={editor.toggleSelectedLock}
            onChange={editor.updateElement}
          />
        </div>
      </div>
    </section>
  )
}
