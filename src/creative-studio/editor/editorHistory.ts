import type { CompositionElement } from '../domain/sceneGraph'
import { cloneCompositionElements } from './editorOperations'

export type EditorHistoryState = {
  past: CompositionElement[][]
  present: CompositionElement[]
  future: CompositionElement[][]
}

export type EditorHistoryAction =
  | { type: 'reset'; elements: CompositionElement[] }
  | { type: 'commit'; elements: CompositionElement[] }
  | { type: 'preview'; elements: CompositionElement[] }
  | { type: 'finalize-preview'; before: CompositionElement[] }
  | { type: 'undo' }
  | { type: 'redo' }

const HISTORY_LIMIT = 100

export function createEditorHistory(elements: CompositionElement[]): EditorHistoryState {
  return {
    past: [],
    present: cloneCompositionElements(elements),
    future: [],
  }
}

function elementsAreEqual(left: CompositionElement[], right: CompositionElement[]): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

export function editorHistoryReducer(
  state: EditorHistoryState,
  action: EditorHistoryAction,
): EditorHistoryState {
  switch (action.type) {
    case 'reset':
      return createEditorHistory(action.elements)
    case 'commit': {
      if (elementsAreEqual(state.present, action.elements)) return state
      return {
        past: [...state.past, cloneCompositionElements(state.present)].slice(-HISTORY_LIMIT),
        present: cloneCompositionElements(action.elements),
        future: [],
      }
    }
    case 'preview':
      return { ...state, present: cloneCompositionElements(action.elements) }
    case 'finalize-preview': {
      if (elementsAreEqual(action.before, state.present)) return state
      return {
        past: [...state.past, cloneCompositionElements(action.before)].slice(-HISTORY_LIMIT),
        present: cloneCompositionElements(state.present),
        future: [],
      }
    }
    case 'undo': {
      const previous = state.past.at(-1)
      if (!previous) return state
      return {
        past: state.past.slice(0, -1),
        present: cloneCompositionElements(previous),
        future: [cloneCompositionElements(state.present), ...state.future],
      }
    }
    case 'redo': {
      const next = state.future[0]
      if (!next) return state
      return {
        past: [...state.past, cloneCompositionElements(state.present)].slice(-HISTORY_LIMIT),
        present: cloneCompositionElements(next),
        future: state.future.slice(1),
      }
    }
  }
}
