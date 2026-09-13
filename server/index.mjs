import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { analyzeSingleReference, composeOrRefine } from './creativeEngine.mjs'
import { imageModel, proposeDirections, textModel } from './openaiClient.mjs'

const serverDirectory = path.dirname(fileURLToPath(import.meta.url))
const staticRoot = path.resolve(serverDirectory, '../dist')
const port = Number(process.env.PORT) || 10000
const allowedOrigins = new Set(
  (process.env.ALLOWED_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
)
const requestsByAddress = new Map()

const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.svg', 'image/svg+xml'],
  ['.webmanifest', 'application/manifest+json'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
])

function corsHeaders(request) {
  const origin = request.headers.origin
  if (!origin) return {}
  const protocol = String(request.headers['x-forwarded-proto'] || 'http').split(',')[0].trim()
  const sameOrigin = request.headers.host ? `${protocol}://${request.headers.host}` : undefined
  if (!allowedOrigins.has(origin) && origin !== sameOrigin) {
    const error = new Error('Origin is not allowed.')
    error.statusCode = 403
    throw error
  }
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    Vary: 'Origin',
  }
}

function json(response, statusCode, payload, headers = {}) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  })
  response.end(JSON.stringify(payload))
}

async function readJson(request) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > 30 * 1024 * 1024) {
      const error = new Error('Request body exceeds 30 MB.')
      error.statusCode = 413
      throw error
    }
    chunks.push(chunk)
  }
  if (chunks.length === 0) return {}
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    const error = new Error('Request body must be valid JSON.')
    error.statusCode = 400
    throw error
  }
}

function enforceRateLimit(request) {
  const forwarded = String(request.headers['x-forwarded-for'] || '').split(',')[0].trim()
  const address = forwarded || request.socket.remoteAddress || 'unknown'
  const now = Date.now()
  const current = requestsByAddress.get(address)
  if (!current || now - current.startedAt > 60_000) {
    requestsByAddress.set(address, { startedAt: now, count: 1 })
    return
  }
  current.count += 1
  if (current.count > 30) {
    const error = new Error('Too many Creative Engine requests. Try again shortly.')
    error.statusCode = 429
    throw error
  }
}

async function handleApi(request, response, pathname, headers) {
  if (pathname === '/api/creative/health' && request.method === 'GET') {
    json(response, 200, {
      ok: true,
      service: 'inest-creative-engine',
      configured: Boolean(process.env.OPENAI_API_KEY),
      textModel,
      imageModel,
    }, headers)
    return
  }
  if (request.method === 'OPTIONS') {
    response.writeHead(204, headers)
    response.end()
    return
  }
  if (request.method !== 'POST') {
    json(response, 405, { error: 'Method not allowed.' }, headers)
    return
  }

  enforceRateLimit(request)
  const body = await readJson(request)
  if (pathname === '/api/creative/directions') {
    json(response, 200, await proposeDirections(body), headers)
    return
  }
  if (pathname === '/api/creative/reference-analysis') {
    json(response, 200, await analyzeSingleReference(body), headers)
    return
  }
  if (pathname === '/api/creative/composition') {
    json(response, 200, await composeOrRefine(body, 'composition'), headers)
    return
  }
  if (pathname === '/api/creative/refine') {
    json(response, 200, await composeOrRefine(body, 'refinement'), headers)
    return
  }
  json(response, 404, { error: 'Creative Engine endpoint not found.' }, headers)
}

async function serveStatic(response, pathname) {
  const requested = pathname === '/' ? '/index.html' : decodeURIComponent(pathname)
  let target = path.resolve(staticRoot, `.${requested}`)
  if (!target.startsWith(`${staticRoot}${path.sep}`) && target !== staticRoot) {
    response.writeHead(403).end()
    return
  }
  try {
    const targetStat = await stat(target)
    if (targetStat.isDirectory()) target = path.join(target, 'index.html')
  } catch {
    target = path.join(staticRoot, 'index.html')
  }
  try {
    const bytes = await readFile(target)
    response.writeHead(200, {
      'Content-Type': contentTypes.get(path.extname(target).toLowerCase()) || 'application/octet-stream',
    })
    response.end(bytes)
  } catch {
    json(response, 404, { error: 'Static build not found. Run pnpm build first.' })
  }
}

const server = createServer(async (request, response) => {
  let headers = {}
  try {
    const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`)
    if (url.pathname.startsWith('/api/creative/')) {
      headers = corsHeaders(request)
      await handleApi(request, response, url.pathname, headers)
    } else {
      await serveStatic(response, url.pathname)
    }
  } catch (cause) {
    const statusCode = Number(cause?.statusCode) || 500
    json(response, statusCode, {
      error: cause instanceof Error ? cause.message : 'Unexpected gateway error.',
      ...(cause?.code ? { code: cause.code } : {}),
    }, headers)
  }
})

server.listen(port, '0.0.0.0', () => {
  console.log(`iNest Creative Engine listening on port ${port}`)
})
