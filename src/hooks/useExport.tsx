import { toCanvas } from 'html-to-image'
import JSZip from 'jszip'
import { DEFAULT_AVATAR_SRC, type TweetSlide } from '../types/project'

const fileName = (index: number) => `inest-tweet-slide-${String(index + 1).padStart(2, '0')}.png`
const backgroundForTheme = (theme: TweetSlide['theme']) => theme === 'light' ? '#F5F7FA' : '#050505'

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

type Rect = { x: number; y: number; width: number; height: number }

function relativeRect(element: HTMLElement, card: HTMLElement): Rect {
  const bounds = element.getBoundingClientRect()
  const cardBounds = card.getBoundingClientRect()
  return { x: bounds.left - cardBounds.left, y: bounds.top - cardBounds.top, width: bounds.width, height: bounds.height }
}

function roundedRect(context: CanvasRenderingContext2D, { x, y, width, height }: Rect, radius: number) {
  const r = Math.min(radius, width / 2, height / 2)
  context.beginPath()
  context.moveTo(x + r, y)
  context.lineTo(x + width - r, y)
  context.quadraticCurveTo(x + width, y, x + width, y + r)
  context.lineTo(x + width, y + height - r)
  context.quadraticCurveTo(x + width, y + height, x + width - r, y + height)
  context.lineTo(x + r, y + height)
  context.quadraticCurveTo(x, y + height, x, y + height - r)
  context.lineTo(x, y + r)
  context.quadraticCurveTo(x, y, x + r, y)
  context.closePath()
}

function drawCover(context: CanvasRenderingContext2D, image: HTMLImageElement, width: number, height: number) {
  const sourceWidth = image.naturalWidth
  const sourceHeight = image.naturalHeight
  if (!sourceWidth || !sourceHeight) return
  const scale = Math.max(width / sourceWidth, height / sourceHeight)
  const drawWidth = sourceWidth * scale
  const drawHeight = sourceHeight * scale
  context.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight)
}

function transformValues(image: HTMLImageElement) {
  const transform = getComputedStyle(image).transform
  const values = transform.match(/^matrix\\((.+)\\)$/)?.[1].split(',').map(Number)
  return values?.length === 6 ? values : [1, 0, 0, 1, 0, 0]
}

function drawExportImages(canvas: HTMLCanvasElement, card: HTMLElement) {
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Não foi possível finalizar a imagem exportada.')

  const avatar = card.querySelector<HTMLImageElement>('.avatar-wrap img')
  if (avatar) {
    const frame = relativeRect(avatar.parentElement as HTMLElement, card)
    context.save()
    context.beginPath()
    context.arc(frame.x + frame.width / 2, frame.y + frame.height / 2, frame.width / 2, 0, Math.PI * 2)
    context.clip()
    context.translate(frame.x, frame.y)
    drawCover(context, avatar, frame.width, frame.height)
    context.restore()
  }

  const media = card.querySelector<HTMLElement>('.tweet-media')
  const mediaFrame = media ? relativeRect(media, card) : null
  if (!media || !mediaFrame) return

  card.querySelectorAll<HTMLImageElement>('.media-image img').forEach(image => {
    const frameElement = image.parentElement as HTMLElement
    const frame = relativeRect(frameElement, card)
    const style = getComputedStyle(image)
    const [a, b, c, d, e, f] = transformValues(image)
    const [originX = 0, originY = 0] = style.transformOrigin.split(' ').map(value => Number.parseFloat(value))

    context.save()
    roundedRect(context, mediaFrame, Number.parseFloat(getComputedStyle(media).borderRadius) || 0)
    context.clip()
    context.beginPath()
    context.rect(frame.x, frame.y, frame.width, frame.height)
    context.clip()
    context.translate(frame.x + originX, frame.y + originY)
    context.transform(a, b, c, d, e, f)
    context.translate(-originX, -originY)
    drawCover(context, image, frame.width, frame.height)
    context.restore()
  })
}

async function render(slide: TweetSlide, avatarSrc = DEFAULT_AVATAR_SRC) {
  const node = document.createElement('div')
  node.className = 'export-host'
  document.body.appendChild(node)
  const { createRoot } = await import('react-dom/client')
  const { flushSync } = await import('react-dom')
  const { TweetCard } = await import('../components/TweetCard/TweetCard')
  const root = createRoot(node)

  try {
    flushSync(() => root.render(<TweetCard slide={slide} exportMode avatarSrc={avatarSrc} />))
    const card = node.firstElementChild as HTMLElement
    await nextPaint()
    // The PNG renderer runs on a cloned DOM. Embed every image first so local
    // uploads, the fixed avatar and the verification badge survive that clone.
    await inlineImages(card)
    await nextPaint()
    const canvas = await toCanvas(card, {
      width: 1080,
      height: 1350,
      pixelRatio: 1,
      cacheBust: false,
      // html-to-image applies this to both the cloned root and final canvas.
      // It must therefore always match the active TweetCard theme.
      backgroundColor: backgroundForTheme(slide.theme),
    })
    // Safari may omit <img> elements while turning a foreignObject into PNG.
    // Paint the already-loaded originals over that canvas as a native fallback.
    drawExportImages(canvas, card)
    return canvas.toDataURL('image/png')
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
  const exportOne = async (slide: TweetSlide, index: number, destination: 'save' | 'gallery' | 'share' = 'save', avatarSrc = DEFAULT_AVATAR_SRC) => { const dataUrl = await render(slide, avatarSrc); const blob = await (await fetch(dataUrl)).blob(); const file = new File([blob], fileName(index), { type: 'image/png' }); if ((destination === 'gallery' || destination === 'share') && navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: 'iNest Tweet Card' }); return } await saveToComputer(blob, file.name, file.type) }
  const exportAll = async (slides: TweetSlide[], originalIndexes?: number[], avatarSrc = DEFAULT_AVATAR_SRC) => { const zip = new JSZip(); for (let index = 0; index < slides.length; index++) { const dataUrl = await render(slides[index], avatarSrc); zip.file(fileName(originalIndexes?.[index] ?? index), dataUrl.split(',')[1], { base64: true }) } await saveToComputer(await zip.generateAsync({ type: 'blob' }), 'inest-tweet-carousel.zip', 'application/zip') }
  return { exportOne, exportAll }
}
