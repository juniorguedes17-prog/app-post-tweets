const DEFAULT_TIMEOUT_MS = Number(process.env.CREATIVE_HARNESS_TIMEOUT_MS) || 120_000
const DEFAULT_GATEWAY_URL = process.env.CREATIVE_ENGINE_URL || 'https://inest-creative-ai-gateway.onrender.com'

export class CreativeDirectionsHarnessError extends Error {
  constructor(kind, message, details = {}, cause) {
    super(message, { cause })
    this.name = 'CreativeDirectionsHarnessError'
    this.kind = kind
    this.details = details
  }
}

function parseBody(bodyText) {
  try {
    return JSON.parse(bodyText)
  } catch {
    return bodyText
  }
}

function causeDetails(cause) {
  if (cause instanceof Error) {
    return {
      name: cause.name,
      message: cause.message,
      ...(cause.cause ? { cause: causeDetails(cause.cause) } : {}),
    }
  }
  return { value: String(cause) }
}

export async function requestCreativeDirections({
  payload,
  gatewayUrl = DEFAULT_GATEWAY_URL,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fetchImpl = fetch,
}) {
  const controller = new AbortController()
  const startedAt = performance.now()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetchImpl(`${gatewayUrl.replace(/\/$/, '')}/api/creative/directions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    const bodyText = await response.text()
    const result = {
      status: response.status,
      ok: response.ok,
      latencyMs: Math.round(performance.now() - startedAt),
      body: parseBody(bodyText),
    }
    if (!response.ok) {
      throw new CreativeDirectionsHarnessError(
        'http',
        `Gateway returned HTTP ${response.status}.`,
        result,
      )
    }
    return result
  } catch (cause) {
    if (controller.signal.aborted) {
      throw new CreativeDirectionsHarnessError(
        'timeout',
        `Gateway request timed out after ${timeoutMs} ms.`,
        { latencyMs: Math.round(performance.now() - startedAt), timeoutMs },
        cause,
      )
    }
    if (cause instanceof CreativeDirectionsHarnessError) throw cause
    throw new CreativeDirectionsHarnessError(
      'transport',
      'Gateway request failed before an HTTP response was received.',
      { latencyMs: Math.round(performance.now() - startedAt) },
      cause,
    )
  } finally {
    clearTimeout(timeout)
  }
}

async function readStdin() {
  const chunks = []
  for await (const chunk of process.stdin) chunks.push(chunk)
  const text = Buffer.concat(chunks).toString('utf8').trim()
  if (!text) throw new Error('Provide a CreativeDirections payload as JSON through stdin.')
  return JSON.parse(text)
}

if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replaceAll('\\', '/')}`).href) {
  try {
    const result = await requestCreativeDirections({ payload: await readStdin() })
    process.stdout.write(`${JSON.stringify(result)}\n`)
  } catch (error) {
    process.stderr.write(`${JSON.stringify({
      name: error instanceof Error ? error.name : 'UnknownError',
      message: error instanceof Error ? error.message : String(error),
      kind: error?.kind,
      details: error?.details,
      cause: error?.cause ? causeDetails(error.cause) : undefined,
    })}\n`)
    process.exitCode = 1
  }
}
