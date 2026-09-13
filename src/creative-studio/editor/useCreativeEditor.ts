import { useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import type { CompositionRevision } from '../domain/composition'
import type { CompositionElementId, ElementLockId } from '../domain/ids'
import type { ElementLock, InvariantValidation, LockScope } from '../domain/locks'
import type { CompositionElement } from '../domain/sceneGraph'
import {
  createElementLock,
  getLockedScopes,
  isLockScopeActive,
  validateLockedElements,
} from '../locks/lockEngine'
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
let fallbackLockIdSequence = 0

function defaultCreateElementId(): CompositionElementId {
  const randomId = globalThis.crypto?.randomUUID?.()
  fallbackIdSequence += 1
  return `element-${randomId ?? `${Date.now()}-${fallbackIdSequence}`}` as CompositionElementId
}

function defaultCreateLockId(): ElementLockId {
  const randomId = globalThis.crypto?.randomUUID?.()
  fallbackLockIdSequence += 1
  return `lock-${randomId ?? `${Date.now()}-${fallbackLockIdSequence}`}` as ElementLockId
}

export type UseCreativeEditorOptions = {
  revision: CompositionRevision
  createElementId?: ElementIdFactory
  locks?: ElementLock[]
  createLockId?: () => ElementLockId
  onLocksChange?: (locks: ElementLock[]) => void
  onInvariantViolation?: (validation: InvariantValidation) => void
  onWorkingElementsChange?: (elements: CompositionElement[]) => void
}

export function useCreativeEditor({
  revision,
  createElementId = defaultCreateElementId,
  locks,
  createLockId = defaultCreateLockId,
  onLocksChange,
  onInvariantViolation,
  onWorkingElementsChange,
}: UseCreativeEditorOptions) {
  const [history, dispatch] = useReducer(
    editorHistoryReducer,
    revision.elements,
    createEditorHistory,
  )
  const [selectedElementId, setSelectedElementId] = useState<CompositionElementId>()
  const [uncontrolledLocks, setUncontrolledLocks] = useState<ElementLock[]>([])
  const [lastInvariantValidation, setLastInvariantValidation] = useState<InvariantValidation>()
  const activeLocks = locks ?? uncontrolledLocks

  useEffect(() => {
    dispatch({ type: 'reset', elements: revision.elements })
    setSelectedElementId(undefined)
    setLastInvariantValidation(undefined)
    if (locks === undefined) setUncontrolledLocks([])
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

  const validateCandidate = useCallback(
    (elements: CompositionElement[]): InvariantValidation =>
      validateLockedElements(revision, elements, activeLocks),
    [activeLocks, revision],
  )

  const acceptCandidate = useCallback(
    (elements: CompositionElement[]): boolean => {
      const validation = validateCandidate(elements)
      if (validation.valid) {
        setLastInvariantValidation(undefined)
        return true
      }
      setLastInvariantValidation(validation)
      onInvariantViolation?.(validation)
      return false
    },
    [onInvariantViolation, validateCandidate],
  )

  const commitElements = useCallback(
    (elements: CompositionElement[]): boolean => {
      if (!acceptCandidate(elements)) return false
      dispatch({ type: 'commit', elements })
      return true
    },
    [acceptCandidate],
  )

  const previewElements = useCallback(
    (elements: CompositionElement[]): boolean => {
      if (!acceptCandidate(elements)) return false
      dispatch({ type: 'preview', elements })
      return true
    },
    [acceptCandidate],
  )

  const finalizePreview = useCallback(
    (before: CompositionElement[]): boolean => {
      if (!acceptCandidate(history.present)) {
        dispatch({ type: 'preview', elements: before })
        return false
      }
      dispatch({ type: 'finalize-preview', before })
      return true
    },
    [acceptCandidate, history.present],
  )

  const updateElement = useCallback(
    (element: CompositionElement) => {
      return commitElements(replaceCompositionElement(history.present, element))
    },
    [commitElements, history.present],
  )

  const deleteSelected = useCallback(() => {
    if (!selectedElementId) return
    if (commitElements(deleteCompositionElement(history.present, selectedElementId))) {
      setSelectedElementId(undefined)
    }
  }, [commitElements, history.present, selectedElementId])

  const duplicateSelected = useCallback(() => {
    if (!selectedElementId) return
    const result = duplicateCompositionElement(
      history.present,
      selectedElementId,
      createElementId,
    )
    if (commitElements(result.elements)) setSelectedElementId(result.duplicatedElementId)
  }, [commitElements, createElementId, history.present, selectedElementId])

  const moveSelectedLayer = useCallback(
    (direction: LayerDirection) => {
      if (!selectedElementId) return
      commitElements(moveElementLayer(history.present, selectedElementId, direction))
    },
    [commitElements, history.present, selectedElementId],
  )

  const publishLocks = useCallback(
    (nextLocks: ElementLock[]) => {
      if (locks === undefined) setUncontrolledLocks(nextLocks)
      onLocksChange?.(nextLocks)
    },
    [locks, onLocksChange],
  )

  const lockedScopesForElement = useCallback(
    (elementId: CompositionElementId): LockScope[] =>
      getLockedScopes(revision, activeLocks, elementId),
    [activeLocks, revision],
  )

  const isElementScopeLocked = useCallback(
    (elementId: CompositionElementId, scope: LockScope): boolean =>
      isLockScopeActive(lockedScopesForElement(elementId), scope),
    [lockedScopesForElement],
  )

  const toggleSelectedLock = useCallback(
    (scope: LockScope) => {
      if (!selectedElement) return
      const selectedScopes = lockedScopesForElement(selectedElement.id)
      const currentlyLocked = selectedScopes.includes(scope)
      const applicable = (lock: ElementLock) =>
        lock.compositionId === revision.compositionId &&
        lock.revisionId === revision.id &&
        lock.elementId === selectedElement.id

      if (currentlyLocked) {
        publishLocks(
          activeLocks.flatMap((lock) => {
            if (!applicable(lock) || !lock.scopes.includes(scope)) return [lock]
            const scopes = lock.scopes.filter((lockScope) => lockScope !== scope)
            return scopes.length > 0 ? [{ ...lock, scopes }] : []
          }),
        )
        return
      }

      publishLocks([
        ...activeLocks,
        createElementLock({
          id: createLockId(),
          compositionId: revision.compositionId,
          revisionId: revision.id,
          element: selectedElement,
          scope,
          createdAt: Date.now(),
        }),
      ])
    },
    [
      activeLocks,
      createLockId,
      lockedScopesForElement,
      publishLocks,
      revision.compositionId,
      revision.id,
      selectedElement,
    ],
  )

  const undoCandidate = history.past.at(-1)
  const redoCandidate = history.future[0]
  const canUndo = Boolean(undoCandidate && validateCandidate(undoCandidate).valid)
  const canRedo = Boolean(redoCandidate && validateCandidate(redoCandidate).valid)

  const undo = useCallback(() => {
    if (!undoCandidate || !acceptCandidate(undoCandidate)) return
    dispatch({ type: 'undo' })
  }, [acceptCandidate, undoCandidate])

  const redo = useCallback(() => {
    if (!redoCandidate || !acceptCandidate(redoCandidate)) return
    dispatch({ type: 'redo' })
  }, [acceptCandidate, redoCandidate])

  return {
    elements: history.present,
    selectedElement,
    selectedElementId,
    locks: activeLocks,
    lastInvariantValidation,
    canUndo,
    canRedo,
    selectElement: setSelectedElementId,
    commitElements,
    previewElements,
    finalizePreview,
    updateElement,
    deleteSelected,
    duplicateSelected,
    moveSelectedLayer,
    lockedScopesForElement,
    isElementScopeLocked,
    toggleSelectedLock,
    undo,
    redo,
  }
}
