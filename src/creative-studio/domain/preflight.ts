import type { CompositionRevisionId, CompositionElementId } from './ids'
import type { Timestamp } from './serialization'

export type PreflightSeverity = 'info' | 'warning' | 'error'

export type PreflightMetricName =
  | 'hierarchy'
  | 'photo-dominance'
  | 'density'
  | 'negative-space'
  | 'color-count'
  | 'typography-coherence'
  | 'product-scale'
  | 'cta-clarity'
  | 'brand-compliance'
  | 'advertising-appearance'
  | 'lock-integrity'
  | (string & {})

export type PreflightIssue = {
  ruleId: string
  metric?: PreflightMetricName
  severity: PreflightSeverity
  elementIds?: CompositionElementId[]
  message: string
}

export type PreflightThreshold =
  | { mode: 'minimum'; value: number }
  | { mode: 'maximum'; value: number }
  | { mode: 'range'; min: number; max: number }

export type PreflightRuleConfiguration = {
  ruleId: string
  metric: PreflightMetricName
  enabled: boolean
  severity: PreflightSeverity
  threshold: PreflightThreshold
  /** Relative contribution to a future aggregate score. */
  weight: number
}

/** Declarative inputs for a future preflight validator; no rule is executed in the domain layer. */
export type UGCPreflightConfiguration = {
  version: string
  rules: PreflightRuleConfiguration[]
}

export type PreflightResult = {
  valid: boolean
  score?: number
  metrics?: Partial<Record<PreflightMetricName, number>>
  issues: PreflightIssue[]
  checkedRevisionId: CompositionRevisionId
  validatorVersion: string
  createdAt: Timestamp
}
