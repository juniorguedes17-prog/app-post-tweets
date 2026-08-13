import { toPng } from 'html-to-image'
import JSZip from 'jszip'
import type { TweetSlide } from '../types/project'

const fileName = (index: number) => `inest-tweet-slide-${String(index + 1).padStart(2, '0')}.png`
async function render(slide: TweetSlide) {
  const node = document.createElement('div'); node.className = 'export-host'; document.body.appendChild(node)
  const { createRoot } = await import('react-dom/client'); const { TweetCard } = await import('../components/TweetCard/TweetCard'); const root = createRoot(node)
  root.render(<TweetCard slide={slide} exportMode />)
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  const dataUrl = await toPng(node.firstElementChild as HTMLElement, { width: 1080, height: 1350, pixelRatio: 1, cacheBust: false, backgroundColor: '#050505' })
  root.unmount(); node.remove(); return dataUrl
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
