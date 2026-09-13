import { useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import type { CompositionRevision } from '../domain/composition'
import type { CompositionElementId } from '../domain/ids'
import type { CompositionElement } from '../domain/sceneGraph'
import {
  deleteCompositionElement,
  duplicateCompositionElement,
  moveElementLayer,
  replaceCompositionElement,
  type ElementIdFactory,
  type LayerDirection,
} from './editorOperations'
import { createEditorHistory, editorHistoryReducer } from './editorHistory'

let fallbackIdSequence = 0

function defaultCreateElementId(): CompositionElementId {
  const randomId = globalThis.crypto?.randomUUID?.()
  fallbackIdSequence += 1
  return `element-${randomId ?? `${Date.now()}-${fallbackIdSequence}`}` as CompositionElementId
}

export type UseCreativeEditorOptions = {
  revision: CompositionRevision
  createElementId?: ElementIdFactory
  onWorkingElementsChange?: (elements: CompositionElement[]) => void
}

export function useCreativeEditor({
  revision,
  createElementId = defaultCreateElementId,
  onWorkingElementsChange,
}: UseCreativeEditorOptions) {
  const [history, dispatch] = useReducer(
    editorHistoryReducer,
    revision.elements,
    createEditorHistory,
  )
  const [selectedElementId, setSelectedElementId] = useState<CompositionElementId>()

  useEffect(() => {
    dispatch({ type: 'reset', elements: revision.elements })
    setSelectedElementId(undefined)
  }, [revision.id])

  useEffect(() => {
    onWorkingElementsChange?.(history.present)
  }, [history.present, onWorkingElementsChange])

  const selectedElement = useMemo(
    () => history.present.find((element) => element.id === selectedElementId),
    [history.present, selectedElementId],
  )

  useEffect(() => {
    if (selectedElementId && !selectedElement) setSelectedElementId(undefined)
  }, [selectedElement, selectedElementId])

  const commitElements = useCallback((elements: CompositionElement[]) => {
    dispatch({ type: 'commit', elements })
  }, [])

  const previewElements = useCallback((elements: CompositionElement[]) => {
    dispatch({ type: 'preview', elements })
  }, [])

  const finalizePreview = useCallback((before: CompositionElement[]) => {
    dispatch({ type: 'finalize-preview', before })
  }, [])

  const updateElement = useCallback(
    (element: CompositionElement) => {
      commitElements(replaceCompositionElement(history.present, element))
    },
    [commitElements, history.present],
  )

  const deleteSelected = useCallback(() => {
    if (!selectedElementId) return
    commitElements(deleteCompositionElement(history.present, selectedElementId))
    setSelectedElementId(undefined)
  }, [commitElements, history.present, selectedElementId])

  const duplicateSelected = useCallback(() => {
    if (!selectedElementId) return
    const result = duplicateCompositionElement(
      history.present,
      selectedElementId,
      createElementId,
    )
    commitElements(result.elements)
    setSelectedElementId(result.duplicatedElementId)
  }, [commitElements, createElementId, history.present, selectedElementId])

  const moveSelectedLayer = useCallback(
    (direction: LayerDirection) => {
      if (!selectedElementId) return
      commitElements(moveElementLayer(history.present, selectedElementId, direction))
    },
    [commitElements, history.present, selectedElementId],
  )

  return {
    elements: history.present,
    selectedElement,
    selectedElementId,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    selectElement: setSelectedElementId,
    commitElements,
    previewElements,
    finalizePreview,
    updateElement,
    deleteSelected,
    duplicateSelected,
    moveSelectedLayer,
    undo: () => dispatch({ type: 'undo' }),
    redo: () => dispatch({ type: 'redo' }),
  }
}
