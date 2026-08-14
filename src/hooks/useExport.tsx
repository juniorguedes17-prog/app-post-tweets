import { toPng } from 'html-to-image'
import JSZip from 'jszip'
import type { TweetSlide } from '../types/project'

const fileName = (index: number) => `inest-tweet-slide-${String(index + 1).padStart(2, '0')}.png`

const nextPaint = () => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))

function waitForImage(image: HTMLImageElement) {
  if (image.complete && image.naturalWidth > 0) return image.decode?.().catch(() => undefined) ?? Promise.resolve()

  return new Promise<void>((resolve, reject) => {
    const finish = () => {
      image.removeEventListener('load', onLoad)
      image.removeEventListener('error', onError)
    }
    const onLoad = () => {
      finish()
      void (image.decode?.().catch(() => undefined) ?? Promise.resolve()).then(resolve)
    }
    const onError = () => {
      finish()
      reject(new Error('Uma imagem do card não pôde ser carregada para a exportação.'))
    }
    image.addEventListener('load', onLoad, { once: true })
    image.addEventListener('error', onError, { once: true })
  })
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('Não foi possível preparar a imagem para exportação.'))
    reader.readAsDataURL(blob)
  })
}

async function inlineImages(card: HTMLElement) {
  const images = Array.from(card.querySelectorAll('img'))
  await Promise.all(images.map(async image => {
    await waitForImage(image)
    const source = image.currentSrc || image.src
    if (source.startsWith('data:')) return

    const response = await fetch(source)
    if (!response.ok) throw new Error('Uma imagem do card não pôde ser preparada para a exportação.')
    image.src = await blobToDataUrl(await response.blob())
    await waitForImage(image)
  }))
}

async function render(slide: TweetSlide) {
  const node = document.createElement('div')
  node.className = 'export-host'
  document.body.appendChild(node)
  const { createRoot } = await import('react-dom/client')
  const { flushSync } = await import('react-dom')
  const { TweetCard } = await import('../components/TweetCard/TweetCard')
  const root = createRoot(node)

  try {
    flushSync(() => root.render(<TweetCard slide={slide} exportMode />))
    const card = node.firstElementChild as HTMLElement
    await nextPaint()
    // The PNG renderer runs on a cloned DOM. Embed every image first so local
    // uploads, the fixed avatar and the verification badge survive that clone.
    await inlineImages(card)
    await nextPaint()
    return await toPng(card, { width: 1080, height: 1350, pixelRatio: 1, cacheBust: false, backgroundColor: '#050505' })
  } finally {
    root.unmount()
    node.remove()
  }
}
function download(blob: Blob, name: string) { const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000) }
type SavePicker = { createWritable: () => Promise<{ write: (data: Blob) => Promise<void>; close: () => Promise<void> }> }
const picker = () => (window as Window & { showSaveFilePicker?: (options: { suggestedName: string; types: { description: string; accept: Record<string, string[]> }[] }) => Promise<SavePicker> }).showSaveFilePicker
async function saveToComputer(blob: Blob, name: string, type: string) {
  const openPicker = picker()
  if (!openPicker) return download(blob, name)
  try {
    const handle = await openPicker({ suggestedName: name, types: [{ description: type === 'image/png' ? 'Imagem PNG' : 'Arquivo ZIP', accept: { [type]: [type === 'image/png' ? '.png' : '.zip'] } }] })
    const writable = await handle.createWritable(); await writable.write(blob); await writable.close()
  } catch (error) { if ((error as DOMException).name !== 'AbortError') throw error }
}
export function useExport() {
  const exportOne = async (slide: TweetSlide, index: number, destination: 'save' | 'gallery' | 'share' = 'save') => { const dataUrl = await render(slide); const blob = await (await fetch(dataUrl)).blob(); const file = new File([blob], fileName(index), { type: 'image/png' }); if ((destination === 'gallery' || destination === 'share') && navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: 'iNest Tweet Card' }); return } await saveToComputer(blob, file.name, file.type) }
  const exportAll = async (slides: TweetSlide[]) => { const zip = new JSZip(); for (let index = 0; index < slides.length; index++) { const dataUrl = await render(slides[index]); zip.file(fileName(index), dataUrl.split(',')[1], { base64: true }) } await saveToComputer(await zip.generateAsync({ type: 'blob' }), 'inest-tweet-carousel.zip', 'application/zip') }
  return { exportOne, exportAll }
}
