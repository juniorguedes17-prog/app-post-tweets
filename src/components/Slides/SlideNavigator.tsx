import { memo } from 'react'
import { TweetCard } from '../TweetCard/TweetCard'
import type { TweetSlide } from '../../types/project'

const SlideThumbnail = memo(function SlideThumbnail({ slide, index, active, selected, select, toggle, avatarSrc }: { slide: TweetSlide; index: number; active: boolean; selected: boolean; select: (id: string) => void; toggle: (id: string) => void; avatarSrc?: string }) {
  const number = String(index + 1).padStart(2, '0')
  return <div className={'slide-thumbnail' + (active ? ' active' : '') + (selected ? ' selected' : '')}>
    <div className="slide-thumbnail-frame">
      <div className="slide-thumbnail-card" aria-hidden="true"><TweetCard slide={slide} avatarSrc={avatarSrc} /></div>
      <button type="button" className="slide-thumbnail-hit" onClick={() => select(slide.id)} aria-label={`Abrir slide ${number} para edição`} aria-pressed={active} />
      <label className="slide-thumbnail-select"><input type="checkbox" checked={selected} onChange={() => toggle(slide.id)} aria-label={`Selecionar slide ${number} para exportação`} /></label>
    </div>
    <span className="slide-thumbnail-label">Slide {number}</span>
  </div>
})

export function SlideNavigator({ slides, activeId, select, add, duplicate, remove, selectedExportIds, toggleExportSelection, avatarSrc }: { slides: TweetSlide[]; activeId: string; select: (id: string) => void; add: () => void; duplicate: () => void; remove: () => void; selectedExportIds: Set<string>; toggleExportSelection: (id: string) => void; avatarSrc?: string }) {
  return <nav className="slide-nav" aria-label="Slides"><div className="slide-list">{slides.map((slide, i) => <SlideThumbnail slide={slide} index={i} active={slide.id === activeId} selected={selectedExportIds.has(slide.id)} select={select} toggle={toggleExportSelection} avatarSrc={avatarSrc} key={slide.id} />)}</div><div className="slide-actions"><button className="button secondary" onClick={add}>+ Novo</button><button className="button secondary" onClick={duplicate}>Duplicar</button>{slides.length > 1 && <button className="button danger" onClick={remove}>Excluir</button>}</div></nav>
}
