import type { UGCPreflightConfiguration } from './preflight'
import type { UGCDesignGrammar, UGCGrammarParameters } from './ugcGrammar'

const cleanParameters: UGCGrammarParameters = {
  native: {
    nativeAppearance: 0.88,
    advertisingAppearance: 0.12,
    brandIntensity: 0.22,
    visualSpontaneity: 0.38,
  },
  editorial: {
    hierarchyStrength: 0.82,
    negativeSpace: 0.82,
    visualDensity: 0.24,
    rhythm: 0.68,
    scaleContrast: 0.52,
    imageTextRatio: 0.68,
    editorialPolish: 0.9,
  },
  hierarchy: {
    headlineDominance: 0.68,
    photoDominance: 0.82,
    productProminence: 0.46,
    ctaProminence: 0.28,
  },
  rawness: {
    gridRegularity: 0.9,
    asymmetry: 0.18,
    cropExpressiveness: 0.28,
    overlap: 0.1,
    controlledImperfection: 0.08,
  },
  annotations: {
    frequency: 0.08,
    intensity: 0.12,
    densityLimit: 0.2,
    kinds: {
      'handwritten-text': { enabled: true, frequency: 0.08, intensity: 0.12 },
      arrow: { enabled: true, frequency: 0.05, intensity: 0.1 },
      circle: { enabled: true, frequency: 0.04, intensity: 0.08 },
      highlight: { enabled: true, frequency: 0.08, intensity: 0.12 },
      underline: { enabled: true, frequency: 0.08, intensity: 0.1 },
      scribble: { enabled: false, frequency: 0, intensity: 0 },
    },
  },
}

const rawParameters: UGCGrammarParameters = {
  native: {
    nativeAppearance: 0.96,
    advertisingAppearance: 0.08,
    brandIntensity: 0.3,
    visualSpontaneity: 0.86,
  },
  editorial: {
    hierarchyStrength: 0.86,
    negativeSpace: 0.48,
    visualDensity: 0.6,
    rhythm: 0.78,
    scaleContrast: 0.9,
    imageTextRatio: 0.8,
    editorialPolish: 0.52,
  },
  hierarchy: {
    headlineDominance: 0.76,
    photoDominance: 0.94,
    productProminence: 0.58,
    ctaProminence: 0.34,
  },
  rawness: {
    gridRegularity: 0.24,
    asymmetry: 0.84,
    cropExpressiveness: 0.88,
    overlap: 0.62,
    controlledImperfection: 0.78,
  },
  annotations: {
    frequency: 0.5,
    intensity: 0.62,
    densityLimit: 0.48,
    kinds: {
      'handwritten-text': { enabled: true, frequency: 0.52, intensity: 0.66 },
      arrow: { enabled: true, frequency: 0.42, intensity: 0.58 },
      circle: { enabled: true, frequency: 0.28, intensity: 0.52 },
      highlight: { enabled: true, frequency: 0.46, intensity: 0.58 },
      underline: { enabled: true, frequency: 0.4, intensity: 0.54 },
      scribble: { enabled: true, frequency: 0.2, intensity: 0.48 },
    },
  },
}

const defaultParameters: UGCGrammarParameters = {
  native: {
    nativeAppearance: 0.94,
    advertisingAppearance: 0.1,
    brandIntensity: 0.26,
    visualSpontaneity: 0.72,
  },
  editorial: {
    hierarchyStrength: 0.84,
    negativeSpace: 0.62,
    visualDensity: 0.44,
    rhythm: 0.74,
    scaleContrast: 0.76,
    imageTextRatio: 0.74,
    editorialPolish: 0.66,
  },
  hierarchy: {
    headlineDominance: 0.72,
    photoDominance: 0.9,
    productProminence: 0.54,
    ctaProminence: 0.3,
  },
  rawness: {
    gridRegularity: 0.46,
    asymmetry: 0.66,
    cropExpressiveness: 0.7,
    overlap: 0.42,
    controlledImperfection: 0.58,
  },
  annotations: {
    frequency: 0.34,
    intensity: 0.46,
    densityLimit: 0.38,
    kinds: {
      'handwritten-text': { enabled: true, frequency: 0.36, intensity: 0.5 },
      arrow: { enabled: true, frequency: 0.28, intensity: 0.42 },
      circle: { enabled: true, frequency: 0.18, intensity: 0.36 },
      highlight: { enabled: true, frequency: 0.32, intensity: 0.44 },
      underline: { enabled: true, frequency: 0.3, intensity: 0.4 },
      scribble: { enabled: true, frequency: 0.12, intensity: 0.32 },
    },
  },
}

const inestUgcPreflight: UGCPreflightConfiguration = {
  version: '1.0.0',
  rules: [
    {
      ruleId: 'ugc.hierarchy.minimum',
      metric: 'hierarchy',
      enabled: true,
      severity: 'warning',
      threshold: { mode: 'minimum', value: 0.65 },
      weight: 1,
    },
    {
      ruleId: 'ugc.photo-dominance.minimum',
      metric: 'photo-dominance',
      enabled: true,
      severity: 'warning',
      threshold: { mode: 'minimum', value: 0.65 },
      weight: 1,
    },
    {
      ruleId: 'ugc.density.range',
      metric: 'density',
      enabled: true,
      severity: 'warning',
      threshold: { mode: 'range', min: 0.2, max: 0.72 },
      weight: 0.8,
    },
    {
      ruleId: 'ugc.negative-space.minimum',
      metric: 'negative-space',
      enabled: true,
      severity: 'warning',
      threshold: { mode: 'minimum', value: 0.35 },
      weight: 0.8,
    },
    {
      ruleId: 'ugc.color-count.maximum',
      metric: 'color-count',
      enabled: true,
      severity: 'warning',
      threshold: { mode: 'maximum', value: 6 },
      weight: 0.6,
    },
    {
      ruleId: 'ugc.typography-coherence.minimum',
      metric: 'typography-coherence',
      enabled: true,
      severity: 'warning',
      threshold: { mode: 'minimum', value: 0.7 },
      weight: 0.8,
    },
    {
      ruleId: 'ugc.product-scale.maximum',
      metric: 'product-scale',
      enabled: true,
      severity: 'warning',
      threshold: { mode: 'maximum', value: 0.72 },
      weight: 0.6,
    },
    {
      ruleId: 'ugc.cta-clarity.minimum',
      metric: 'cta-clarity',
      enabled: true,
      severity: 'info',
      threshold: { mode: 'minimum', value: 0.45 },
      weight: 0.5,
    },
    {
      ruleId: 'ugc.brand-compliance.minimum',
      metric: 'brand-compliance',
      enabled: true,
      severity: 'warning',
      threshold: { mode: 'minimum', value: 0.7 },
      weight: 0.9,
    },
    {
      ruleId: 'ugc.advertising-appearance.maximum',
      metric: 'advertising-appearance',
      enabled: true,
      severity: 'warning',
      threshold: { mode: 'maximum', value: 0.35 },
      weight: 1,
    },
  ],
}

/**
 * Official Native Instagram + Editorial UGC + Minimal + Raw grammar.
 * It is structured configuration, not a visual template or an AI prompt.
 */
export const INEST_UGC_DESIGN_GRAMMAR: UGCDesignGrammar = {
  version: '1.0.0',
  defaultIntensity: {
    value: 0.65,
  },
  defaultParameters,
  intensityAxis: {
    clean: cleanParameters,
    raw: rawParameters,
  },
  preflight: inestUgcPreflight,
}
