import type { CreativeWorkingState } from './schema'

export type WorkingStateWriter = {
  saveWorkingState(workingState: CreativeWorkingState): Promise<void>
}

export type CreativeStudioAutosaveOptions = {
  debounceMs?: number
  onError?: (error: unknown) => void
}

type PendingWorkingState = {
  state: CreativeWorkingState
  fingerprint: string
}

/**
 * Debounced, content-aware autosave for the mutable working state only.
 * CompositionRevision records remain immutable and are never written by this class.
 */
export class CreativeStudioAutosave {
  private timer: ReturnType<typeof setTimeout> | undefined
  private pending: PendingWorkingState | undefined
  private lastPersistedFingerprint: string | undefined
  private saveQueue: Promise<void> = Promise.resolve()
  private readonly debounceMs: number

  constructor(
    private readonly writer: WorkingStateWriter,
    options: CreativeStudioAutosaveOptions = {},
  ) {
    this.debounceMs = options.debounceMs ?? 500
    this.onError = options.onError
  }

  private readonly onError: ((error: unknown) => void) | undefined

  schedule(state: CreativeWorkingState): void {
    const pending = {
      state,
      fingerprint: fingerprintWorkingState(state),
    }
    if (
      pending.fingerprint === this.lastPersistedFingerprint ||
      pending.fingerprint === this.pending?.fingerprint
    ) {
      return
    }

    this.pending = pending
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => {
      void this.flush().catch((error: unknown) => this.onError?.(error))
    }, this.debounceMs)
  }

  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = undefined
    }

    const pending = this.pending
    this.pending = undefined
    if (!pending || pending.fingerprint === this.lastPersistedFingerprint) return

    this.saveQueue = this.saveQueue.then(async () => {
      await this.writer.saveWorkingState(pending.state)
      this.lastPersistedFingerprint = pending.fingerprint
    })
    return this.saveQueue
  }

  cancel(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = undefined
    this.pending = undefined
  }
}

function fingerprintWorkingState(state: CreativeWorkingState): string {
  return JSON.stringify({
    documentId: state.documentId,
    projectId: state.projectId,
    compositionId: state.compositionId,
    baseRevisionId: state.baseRevisionId,
    elements: state.elements,
  })
}
