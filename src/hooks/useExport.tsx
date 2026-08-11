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
export function useExport() {
  const exportOne = async (slide: TweetSlide, index: number) => { const dataUrl = await render(slide); const blob = await (await fetch(dataUrl)).blob(); const file = new File([blob], fileName(index), { type: 'image/png' }); if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: 'iNest Tweet Card' }); else download(blob, file.name) }
  const exportAll = async (slides: TweetSlide[]) => { const zip = new JSZip(); for (let index = 0; index < slides.length; index++) { const dataUrl = await render(slides[index]); zip.file(fileName(index), dataUrl.split(',')[1], { base64: true }) } download(await zip.generateAsync({ type: 'blob' }), 'inest-tweet-carousel.zip') }
  return { exportOne, exportAll }
}
