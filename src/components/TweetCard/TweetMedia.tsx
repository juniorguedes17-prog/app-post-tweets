import { useRef } from 'react'
import type { MediaItem } from '../../types/project'

function Picture({ item, onAdjust }: { item: MediaItem; onAdjust?: (patch: Partial<MediaItem>) => void }) {
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<{ cropX: number; cropY: number; zoom: number; midpointX: number; midpointY: number; distance: number } | null>(null)
  const clamp = (value: number) => Math.max(-50, Math.min(50, value))
  const begin = () => {
    const points = [...pointers.current.values()]
    const first = points[0]
    if (!first) {
      gesture.current = null
      return
    }
    const second = points[1] ?? first
    gesture.current = {
      cropX: item.cropX,
      cropY: item.cropY,
      zoom: item.zoom,
      midpointX: (first.x + second.x) / 2,
      midpointY: (first.y + second.y) / 2,
      distance: Math.max(1, Math.hypot(first.x - second.x, first.y - second.y)),
    }
  }
  const finish = (pointerId: number, element: HTMLDivElement) => {
    if (!pointers.current.has(pointerId)) return
    pointers.current.delete(pointerId)
    try {
      if (element.hasPointerCapture(pointerId)) element.releasePointerCapture(pointerId)
    } catch {
      // The browser may have already released the pointer capture.
    }
    if (pointers.current.size) begin()
    else gesture.current = null
  }

  return <div className="media-image" role="group" aria-label="Ajuste da imagem: arraste para reposicionar e use dois dedos para ampliar" onPointerDown={event => {
    if (!onAdjust) return
    event.preventDefault()
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    begin()
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Pointer capture is an enhancement; the gesture remains active without it.
    }
  }} onPointerMove={event => {
    if (!onAdjust || !gesture.current || !pointers.current.has(event.pointerId)) return
    event.preventDefault()
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    const rect = event.currentTarget.getBoundingClientRect()
    if (!Number.isFinite(rect.width) || !Number.isFinite(rect.height) || rect.width <= 0 || rect.height <= 0) return
    const points = [...pointers.current.values()]
    const first = points[0]
    const second = points[1] ?? first
    const midpointX = (first.x + second.x) / 2
    const midpointY = (first.y + second.y) / 2
    const current = gesture.current
    const patch: Partial<MediaItem> = {
      cropX: clamp(current.cropX + (midpointX - current.midpointX) / rect.width * 100),
      cropY: clamp(current.cropY + (midpointY - current.midpointY) / rect.height * 100),
    }
    if (points.length > 1) patch.zoom = Math.min(3, Math.max(1, current.zoom * Math.hypot(first.x - second.x, first.y - second.y) / current.distance))
    onAdjust(patch)
  }} onPointerUp={event => finish(event.pointerId, event.currentTarget)} onPointerCancel={event => finish(event.pointerId, event.currentTarget)} onLostPointerCapture={event => finish(event.pointerId, event.currentTarget)}>
    <img src={item.src} alt="Mídia do tweet" draggable={false} style={{ transform: `translate(${item.cropX}%, ${item.cropY}%) scale(${item.zoom})` }} />
  </div>
}

export function TweetMedia({ media, overlay, onMediaAdjust }: { media: MediaItem[]; overlay: boolean; onMediaAdjust?: (id: string, patch: Partial<MediaItem>) => void }) {
  if (!media.length) return null
  return <div className={'tweet-media ' + (media.length === 2 ? 'split' : '')}><Picture item={media[0]} onAdjust={patch => onMediaAdjust?.(media[0].id, patch)} />{media[1] && <Picture item={media[1]} onAdjust={patch => onMediaAdjust?.(media[1].id, patch)} />}{overlay && <div className="media-overlay"><span>Paulo Afonso | iNest</span></div>}</div>
}
