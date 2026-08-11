import { useRef } from 'react'
import type { MediaItem } from '../../types/project'

export function ImageUploader({ onAdd }: { onAdd: (item: MediaItem) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  const files = (list: FileList | null) => Array.from(list || []).slice(0, 2).forEach(file => { if (/image\/(png|jpeg|webp)/.test(file.type)) { const reader = new FileReader(); reader.onload = () => onAdd({ id: crypto.randomUUID(), src: String(reader.result), zoom: 1, cropX: 0, cropY: 0 }); reader.readAsDataURL(file) } })
  return <div className="upload-zone" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); files(e.dataTransfer.files) }}><input ref={ref} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={e => files(e.target.files)} /><button className="button secondary" onClick={() => ref.current?.click()}>Adicionar fotos</button><small>PNG, JPG ou WEBP · até 2 imagens</small></div>
}
