import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { toBlob } from 'html-to-image'
import JSZip from 'jszip'
import type { CanvasSpec } from '../domain/canvas'
import type { CompositionRevision } from '../domain/composition'
import type { CreativeAssetId } from '../domain/ids'
import type { CompositionElement } from '../domain/sceneGraph'
import { CreativeExportCanvas } from '../renderer/CreativeExportCanvas'

export type CreativeExportPage = {
  revision: CompositionRevision
  canvas: CanvasSpec
  resolveAssetUrl: (assetId: CreativeAssetId) => string | undefined
  fileName?: string
}

export type CreativeExportOptions = {
  fileName?: string
  /** Defaults to one canvas pixel per output pixel. */
  pixelRatio?: number
}

const nextPaint = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))

const isVisualAssetElement = (
  element: CompositionElement,
): element is Extract<CompositionElement, { assetId: CreativeAssetId }> =>
  element.type === 'image' ||
  element.type === 'photo' ||
  element.type === 'product' ||
  element.type === 'logo'

function normalizedFileName(fileName: string | undefined, fallback: string) {
  const base = fileName?.trim() || fallback
  return base.toLowerCase().endsWith('.png') ? base : `${base}.png`
}

function pageFileName(page: CreativeExportPage, pageIndex: number) {
  return normalizedFileName(
    page.fileName,
    `inest-creative-page-${String(pageIndex + 1).padStart(2, '0')}`,
  )
}

function waitForImage(image: HTMLImageElement) {
  if (image.complete && image.naturalWidth > 0) {
    return image.decode?.().catch(() => undefined) ?? Promise.resolve()
  }

  return new Promise<void>((resolve, reject) => {
    const onLoad = () => {
      cleanup()
      void (image.decode?.().catch(() => undefined) ?? Promise.resolve()).then(resolve)
    }
    const onError = () => {
      cleanup()
      reject(new Error('A Creative Studio asset could not be loaded for export.'))
    }
    const cleanup = () => {
      image.removeEventListener('load', onLoad)
      image.removeEventListener('error', onError)
    }
    image.addEventListener('load', onLoad, { once: true })
    image.addEventListener('error', onError, { once: true })
  })
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('Could not prepare an asset for export.'))
    reader.readAsDataURL(blob)
  })
}

async function inlineImages(node: HTMLElement) {
  const images = Array.from(node.querySelectorAll('img'))
  await Promise.all(
    images.map(async (image) => {
      await waitForImage(image)
      const source = image.currentSrc || image.src
      if (source.startsWith('data:')) return

      const response = await fetch(source)
      if (!response.ok) throw new Error('A Creative Studio asset could not be prepared for export.')
      image.src = await blobToDataUrl(await response.blob())
      await waitForImage(image)
    }),
  )
}

async function waitForFonts() {
  if ('fonts' in document) await document.fonts.ready
}

function assertResolvedAssets(page: CreativeExportPage) {
  const unresolved = page.revision.elements
    .filter((element) => element.visible)
    .filter(isVisualAssetElement)
    .find((element) => !page.resolveAssetUrl(element.assetId))
  if (unresolved) {
    throw new Error(`Creative Studio asset ${unresolved.assetId} is unavailable for export.`)
  }
}

function assertSupportedCanvas(canvas: CanvasSpec) {
  if (canvas.format === 'feed-4-5' && (canvas.width !== 1080 || canvas.height !== 1350)) {
    throw new Error('Feed 4:5 exports must use a 1080 × 1350 canvas.')
  }
  if (canvas.format === 'story-9-16' && (canvas.width !== 1080 || canvas.height !== 1920)) {
    throw new Error('Story 9:16 exports must use a 1080 × 1920 canvas.')
  }
}

async function renderExportPage(page: CreativeExportPage, options: CreativeExportOptions = {}) {
  assertSupportedCanvas(page.canvas)
  assertResolvedAssets(page)
  const host = document.createElement('div')
  host.setAttribute('aria-hidden', 'true')
  host.style.cssText = 'position:fixed;left:-100000px;top:0;pointer-events:none;opacity:0;'
  document.body.appendChild(host)
  const root = createRoot(host)

  try {
    flushSync(() =>
      root.render(
        <CreativeExportCanvas
          canvas={page.canvas}
          elements={page.revision.elements}
          resolveAssetUrl={page.resolveAssetUrl}
        />,
      ),
    )
    const canvasNode = host.firstElementChild as HTMLElement | null
    if (!canvasNode) throw new Error('Creative Studio export canvas could not be rendered.')

    await waitForFonts()
    await nextPaint()
    await inlineImages(canvasNode)
    await nextPaint()

    const blob = await toBlob(canvasNode, {
      width: page.canvas.width,
      height: page.canvas.height,
      pixelRatio: options.pixelRatio ?? 1,
      backgroundColor: page.canvas.background,
      cacheBust: false,
    })
    if (!blob) throw new Error('Creative Studio PNG export produced no image data.')
    return blob
  } finally {
    root.unmount()
    host.remove()
  }
}

/** Captures the structured revision without changing its editable scene graph. */
export function exportCreativeRevisionPng(
  page: CreativeExportPage,
  options?: CreativeExportOptions,
) {
  return renderExportPage(page, options)
}

export async function exportCreativePagesZip(pages: CreativeExportPage[]) {
  if (pages.length === 0) throw new Error('Select at least one Creative Studio page to export.')

  const zip = new JSZip()
  for (const [index, page] of pages.entries()) {
    zip.file(pageFileName(page, index), await renderExportPage(page))
  }
  return zip.generateAsync({ type: 'blob' })
}

function download(blob: Blob, fileName: string) {
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = fileName
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(link.href), 1000)
}

export async function saveCreativeExport(
  blob: Blob,
  fileName: string,
  _mimeType: 'image/png' | 'application/zip',
) {
  download(blob, fileName)
}

export async function exportAndSaveCreativeRevision(
  page: CreativeExportPage,
  options: CreativeExportOptions = {},
) {
  const blob = await exportCreativeRevisionPng(page, options)
  await saveCreativeExport(
    blob,
    normalizedFileName(options.fileName ?? page.fileName, 'inest-creative'),
    'image/png',
  )
}

export async function exportAndSaveCreativePagesZip(
  pages: CreativeExportPage[],
  fileName = 'inest-creative-pages.zip',
) {
  const blob = await exportCreativePagesZip(pages)
  await saveCreativeExport(
    blob,
    fileName.toLowerCase().endsWith('.zip') ? fileName : `${fileName}.zip`,
    'application/zip',
  )
}
