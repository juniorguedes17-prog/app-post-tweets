const clamp01 = (value) => Math.min(1, Math.max(0, Number(value) || 0))

function interpolate(clean, raw, intensity) {
  if (typeof clean === 'number' && typeof raw === 'number') {
    return clean + ((raw - clean) * intensity)
  }
  if (Array.isArray(clean)) return [...clean]
  if (clean && raw && typeof clean === 'object' && typeof raw === 'object') {
    return Object.fromEntries(
      Object.keys({ ...clean, ...raw }).map((key) => [
        key,
        interpolate(clean[key], raw[key], intensity),
      ]),
    )
  }
  return raw ?? clean
}

function mergeOverrides(base, overrides) {
  if (!overrides || typeof overrides !== 'object') return base
  return Object.fromEntries(
    Object.keys({ ...base, ...overrides }).map((key) => {
      const override = overrides[key]
      const current = base?.[key]
      if (
        current && override && typeof current === 'object' && typeof override === 'object' &&
        !Array.isArray(current) && !Array.isArray(override)
      ) {
        return [key, mergeOverrides(current, override)]
      }
      return [key, override ?? current]
    }),
  )
}

export function resolveUgcGrammar(brandProfile, intensity) {
  const grammar = brandProfile?.ugcGrammar
  if (!grammar) return undefined
  const value = clamp01(intensity?.value ?? grammar.defaultIntensity?.value ?? 0)
  const parameters = interpolate(grammar.intensityAxis.clean, grammar.intensityAxis.raw, value)
  return {
    version: grammar.version,
    intensity: value,
    parameters: mergeOverrides(parameters, intensity?.overrides),
    preflight: grammar.preflight,
  }
}
