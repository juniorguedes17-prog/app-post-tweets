import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'

const dist = new URL('../dist/', import.meta.url)
const server = new URL('server/', dist)
const textExtensions = new Set(['.css', '.html', '.js', '.json', '.svg', '.txt', '.webmanifest'])
const contentTypes = {
  '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json', '.woff': 'font/woff', '.woff2': 'font/woff2',
}

const files = []
const collect = async directory => {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const location = new URL(entry.isDirectory() ? `${entry.name}/` : entry.name, directory)
    if (entry.isDirectory()) {
      if (entry.name !== 'server' && entry.name !== '.openai') await collect(location)
    } else files.push(location)
  }
}
await collect(dist)

const textAssets = {}
const binaryAssets = {}
for (const file of files) {
  const path = new URL(file).pathname.replace(/^.*\/dist\//, '/')
  const extension = path.slice(path.lastIndexOf('.')).toLowerCase()
  const contentType = contentTypes[extension] ?? 'application/octet-stream'
  if (textExtensions.has(extension)) textAssets[path] = [await readFile(file, 'utf8'), contentType]
  else binaryAssets[path] = [(await readFile(file)).toString('base64'), contentType]
}
textAssets['/'] = textAssets['/index.html']

const worker = `const textAssets=${JSON.stringify(textAssets)};
const binaryAssets=${JSON.stringify(binaryAssets)};
const bytes=b=>Uint8Array.from(atob(b),c=>c.charCodeAt(0));
const headers=(type,path)=>({'content-type':type,'cache-control':path==='/'||path==='/index.html'||path==='/sw.js'?'no-store, max-age=0':'public, max-age=31536000, immutable'});
export default {fetch(request){const path=new URL(request.url).pathname;const text=textAssets[path];if(text)return new Response(text[0],{headers:headers(text[1],path)});const binary=binaryAssets[path];if(binary)return new Response(bytes(binary[0]),{headers:headers(binary[1],path)});return new Response('Not found',{status:404})}};
`
await mkdir(server, { recursive: true })
await writeFile(new URL('index.js', server), worker)
