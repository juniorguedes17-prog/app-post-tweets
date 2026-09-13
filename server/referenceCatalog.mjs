import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const referenceRoot = path.resolve('public/assets/creative-studio/references')

const mimeTypes = new Map([
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.webp', 'image/webp'],
])

async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await filesIn(absolutePath))
    else if (mimeTypes.has(path.extname(entry.name).toLowerCase())) files.push(absolutePath)
  }
  return files
}

export async function loadOfficialReferenceInputs() {
  const files = (await filesIn(referenceRoot)).sort()
  return Promise.all(files.map(async (absolutePath) => {
    const extension = path.extname(absolutePath).toLowerCase()
    const bytes = await readFile(absolutePath)
    const relativePath = path.relative(referenceRoot, absolutePath).replaceAll('\\', '/')
    return {
      id: `official:${relativePath}`,
      purpose: relativePath.startsWith('inest/') ? 'official-inest-dna' : 'official-ugc-reference',
      imageDataUrl: `data:${mimeTypes.get(extension)};base64,${bytes.toString('base64')}`,
    }
  }))
}
