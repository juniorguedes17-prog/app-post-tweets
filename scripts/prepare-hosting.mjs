import { cp, mkdir, readdir, writeFile } from 'node:fs/promises'

const server = new URL('../dist/server/', import.meta.url)
const publicDir = new URL('../dist/public/', import.meta.url)
const root = new URL('../dist/', import.meta.url)

await mkdir(server, { recursive: true })
for (const entry of await readdir(root)) {
  if (entry !== 'server' && entry !== 'public') await cp(new URL(entry, root), new URL(entry, publicDir), { recursive: true })
}
await writeFile(new URL('index.js', server), `export default { fetch(request, env) { return env.ASSETS.fetch(request) } }\n`)
