import { useRef } from 'react'
import type { MediaItem } from '../../types/project'
type TouchPoints = { length: number; [index: number]: { clientX: number; clientY: number } }
function Picture({ item, onAdjust }: { item: MediaItem; onAdjust?: (patch: Partial<MediaItem>) => void }) {
  const last = useRef<{ x: number; y: number; distance: number } | null>(null)
  const distance = (touches: TouchPoints) => touches.length > 1 ? Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY) : 0
  return <div className="media-image" onTouchStart={e => { const touch = e.touches[0]; last.current = { x: touch.clientX, y: touch.clientY, distance: distance(e.touches) } }} onTouchMove={e => { if (!onAdjust || !last.current) return; e.preventDefault(); const touch = e.touches[0]; const rect = e.currentTarget.getBoundingClientRect(); if (e.touches.length > 1) { const next = distance(e.touches); onAdjust({ zoom: Math.min(3, Math.max(1, item.zoom * next / Math.max(1, last.current.distance))) }); last.current = { x: touch.clientX, y: touch.clientY, distance: next }; return } onAdjust({ cropX: Math.max(-50, Math.min(50, item.cropX + (touch.clientX - last.current.x) / rect.width * 100)), cropY: Math.max(-50, Math.min(50, item.cropY + (touch.clientY - last.current.y) / rect.height * 100)) }); last.current = { x: touch.clientX, y: touch.clientY, distance: 0 } }} onTouchEnd={() => { last.current = null }}><img src={item.src} alt="Mídia do tweet" style={{ transform: `translate(${item.cropX}%, ${item.cropY}%) scale(${item.zoom})` }} /></div>
}
export function TweetMedia({ media, overlay, onMediaAdjust }: { media: MediaItem[]; overlay: boolean; onMediaAdjust?: (id: string, patch: Partial<MediaItem>) => void }) {
  if (!media.length) return null
  return <div className={'tweet-media ' + (media.length === 2 ? 'split' : '')}><Picture item={media[0]} onAdjust={patch => onMediaAdjust?.(media[0].id, patch)} />{media[1] && <Picture item={media[1]} onAdjust={patch => onMediaAdjust?.(media[1].id, patch)} />}{overlay && <div className="media-overlay"><span>Paulo Afonso | iNest</span></div>}</div>
}
