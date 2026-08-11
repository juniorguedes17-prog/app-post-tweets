import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'

const dist = new URL('../dist/', import.meta.url)
const server = new URL('server/', dist)
const assets = new URL('assets/', dist)
const names = await readdir(assets)
const js = names.find(name => /^index-.*\.js$/.test(name))
const css = names.find(name => /^index-.*\.css$/.test(name))
if (!js || !css) throw new Error('Assets do Vite não encontrados')

const textAssets = {
  '/': [await readFile(new URL('index.html', dist), 'utf8'), 'text/html; charset=utf-8'],
  '/index.html': [await readFile(new URL('index.html', dist), 'utf8'), 'text/html; charset=utf-8'],
  [`/assets/${js}`]: [await readFile(new URL(`assets/${js}`, dist), 'utf8'), 'text/javascript; charset=utf-8'],
  [`/assets/${css}`]: [await readFile(new URL(`assets/${css}`, dist), 'utf8'), 'text/css; charset=utf-8'],
  '/assets/verified-badge.svg': [await readFile(new URL('../public/assets/verified-badge.svg', import.meta.url), 'utf8'), 'image/svg+xml'],
  '/manifest.webmanifest': [await readFile(new URL('manifest.webmanifest', dist), 'utf8'), 'application/manifest+json'],
}
const binaryAssets = {
  '/assets/avatar-paulo.png': [(await readFile(new URL('../public/assets/avatar-paulo.png', import.meta.url))).toString('base64'), 'image/png'],
  '/icons/icon-192.png': [(await readFile(new URL('../public/icons/icon-192.png', import.meta.url))).toString('base64'), 'image/png'],
  '/icons/icon-512.png': [(await readFile(new URL('../public/icons/icon-512.png', import.meta.url))).toString('base64'), 'image/png'],
}
const worker = `const textAssets=${JSON.stringify(textAssets)};\nconst binaryAssets=${JSON.stringify(binaryAssets)};\nconst bytes=(b)=>Uint8Array.from(atob(b),c=>c.charCodeAt(0));\nexport default {fetch(request){const path=new URL(request.url).pathname;const text=textAssets[path];if(text)return new Response(text[0],{headers:{'content-type':text[1]}});const binary=binaryAssets[path];if(binary)return new Response(bytes(binary[0]),{headers:{'content-type':binary[1]}});return new Response('Not found',{status:404})}};\n`
await mkdir(server, { recursive: true })
await writeFile(new URL('index.js', server), worker)
