import { cp, mkdir, readdir, writeFile } from 'node:fs/promises'

const server = new URL('../dist/server/', import.meta.url)
const publicDir = new URL('../dist/public/', import.meta.url)
const root = new URL('../dist/', import.meta.url)

await mkdir(server, { recursive: true })
for (const entry of await readdir(root)) {
  if (entry !== 'server' && entry !== 'public') await cp(new URL(entry, root), new URL(entry, publicDir), { recursive: true })
}
await writeFile(new URL('index.js', server), `export default {
  fetch(request, env) {
    const url = new URL(request.url)
    if (url.pathname === '/') url.pathname = '/index.html'
    return env.ASSETS.fetch(new Request(url, request))
  },
}\n`)
