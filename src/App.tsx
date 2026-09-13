import { useCallback, useEffect, useMemo, useState } from 'react'
import { EditorPanel } from './components/Editor/EditorPanel'
import { TweetCard } from './components/TweetCard/TweetCard'
import { SlideNavigator } from './components/Slides/SlideNavigator'
import { clearProject, loadProject, saveProject } from './hooks/useProjectStorage'
import { useExport } from './hooks/useExport'
import { blankSlide, DEFAULT_AVATAR_SRC, newProject, type TweetProject, type TweetSlide } from './types/project'
import { CreativeStudioApp } from './creative-studio/CreativeStudioApp'
type Tab = 'content' | 'media' | 'preview' | 'slides'

function TweetCardApp() {
  const [project, setProject] = useState<TweetProject>(newProject)
  const [ready, setReady] = useState(false); const [tab, setTab] = useState<Tab>('content'); const [exporting, setExporting] = useState(false); const [previewZoom, setPreviewZoom] = useState(0.9); const [selectedExportIds, setSelectedExportIds] = useState<Set<string>>(() => new Set())
  const { exportOne, exportAll } = useExport()
  useEffect(() => { loadProject().then(saved => { if (saved?.slides?.length) setProject(saved); setReady(true) }).catch(() => setReady(true)) }, [])
  useEffect(() => { if (ready) { const timer = setTimeout(() => saveProject({ ...project, updatedAt: Date.now() }), 350); return () => clearTimeout(timer) } }, [project, ready])
  useEffect(() => {
    const scaler = document.querySelector<HTMLElement>('.card-scaler')
    if (!scaler) return
    const updatePreviewScale = () => { const width = Math.min(700, scaler.clientWidth); document.documentElement.style.setProperty('--preview-scale', String(width / 1080 * previewZoom)); document.documentElement.style.setProperty('--preview-height', `${width * 1.25 * previewZoom}px`); document.documentElement.style.setProperty('--preview-offset', `${width * (1 - previewZoom) / 2}px`) }
    const observer = new ResizeObserver(updatePreviewScale); observer.observe(scaler); updatePreviewScale(); return () => observer.disconnect()
  }, [ready, previewZoom])
  const active = useMemo(() => project.slides.find(s => s.id === project.activeSlideId) ?? project.slides[0], [project])
  const avatarSrc = project.profileAvatarSrc || DEFAULT_AVATAR_SRC
  const updateAvatar = (src: string) => setProject(p => ({ ...p, profileAvatarSrc: src }))
  const resetAvatar = () => setProject(p => { const next = { ...p }; delete next.profileAvatarSrc; return next })
  const update = (patch: Partial<TweetSlide>) => setProject(p => ({ ...p, slides: p.slides.map(s => s.id === active.id ? { ...s, ...patch } : s) }))
  const select = useCallback((id: string) => setProject(p => ({ ...p, activeSlideId: id })), [])
  const add = () => { const slide = blankSlide(); setProject(p => ({ ...p, slides: [...p.slides, slide], activeSlideId: slide.id })) }
  const duplicate = () => { const slide = { ...active, id: crypto.randomUUID(), media: active.media.map(m => ({ ...m, id: crypto.randomUUID() })) }; setProject(p => ({ ...p, slides: [...p.slides, slide], activeSlideId: slide.id })) }
  const remove = () => { const i = project.slides.findIndex(s => s.id === active.id); const remaining = project.slides.filter(s => s.id !== active.id); setSelectedExportIds(current => { if (!current.has(active.id)) return current; const next = new Set(current); next.delete(active.id); return next }); setProject(p => ({ ...p, slides: remaining, activeSlideId: remaining[Math.max(0, i - 1)].id })) }
  const cardIndex = project.slides.findIndex(s => s.id === active.id); const exceed = active.headline.length + active.body.length > 680; const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  const selectedSlides = project.slides.filter(slide => selectedExportIds.has(slide.id))
  const action = async (all: boolean, destination: 'save' | 'gallery' | 'share' = 'save') => { setExporting(true); try { if (all) { if (selectedSlides.length >= 2) await exportAll(selectedSlides, selectedSlides.map(slide => project.slides.findIndex(item => item.id === slide.id)), avatarSrc); else await exportAll(project.slides, undefined, avatarSrc) } else { const target = selectedSlides.length === 1 ? selectedSlides[0] : active; const targetIndex = selectedSlides.length === 1 ? project.slides.findIndex(slide => slide.id === target.id) : cardIndex; await exportOne(target, targetIndex, destination, avatarSrc) } } catch (error) { console.error(error); alert('Não foi possível gerar a imagem. Tente novamente.') } finally { setExporting(false) } }
  const toggleExportSelection = useCallback((id: string) => setSelectedExportIds(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next }), [])
  const fresh = async () => { if (confirm('Criar um novo projeto? O projeto atual será substituído neste dispositivo.')) { await clearProject(); setSelectedExportIds(new Set()); setProject(newProject()) } }
  const gesture = (id: string, patch: Partial<TweetSlide['media'][number]>) => update({ media: active.media.map(item => item.id === id ? { ...item, ...patch } : item) })
  if (!ready) return <main className="loading">Carregando seu projeto…</main>
  return <main className="app">
    <header className="app-header"><div className="brand-lockup"><img src="/assets/logo-inest-principal.png" alt="iNest — iPhone, iPad e MacBook" /><span>Tweet Cards</span></div><button className="text-button" onClick={fresh}>Novo projeto</button></header>
    <div className="desktop-layout">
      <aside className={'control-column tab-' + tab}>
        <div className="mobile-tabs"><button onClick={() => setTab('content')} className={tab === 'content' ? 'active' : ''}>Conteúdo</button><button onClick={() => setTab('media')} className={tab === 'media' ? 'active' : ''}>Mídia</button><button onClick={() => setTab('preview')} className={tab === 'preview' ? 'active' : ''}>Preview</button><button onClick={() => setTab('slides')} className={tab === 'slides' ? 'active' : ''}>Slides</button></div>
        <div className="editor-wrap"><EditorPanel slide={active} update={update} avatarSrc={avatarSrc} onAvatarChange={updateAvatar} onAvatarReset={resetAvatar} /></div>
        {exceed && <p className="safe-warning">O conteúdo excede a área segura do card.</p>}<p className="privacy">Suas imagens e conteúdos são processados neste dispositivo.</p>
      </aside>
      <section className="preview-column"><div className="preview-label">Preview · 1080 × 1350</div><div className="card-scaler"><TweetCard slide={active} onMediaAdjust={gesture} avatarSrc={avatarSrc} /></div><div className="desktop-slides"><SlideNavigator slides={project.slides} activeId={active.id} select={select} add={add} duplicate={duplicate} remove={remove} selectedExportIds={selectedExportIds} toggleExportSelection={toggleExportSelection} avatarSrc={avatarSrc} /></div><div className="export-actions"><button className="button primary" disabled={exporting} onClick={() => action(false, mobile ? 'gallery' : 'save')}>{exporting ? 'Gerando…' : mobile ? 'Salvar na galeria' : 'Salvar PNG em…'}</button><button className="button secondary" disabled={exporting} onClick={() => action(false, 'share')}>Compartilhar PNG</button><button className="button secondary export-all" disabled={exporting || project.slides.length < 2} onClick={() => action(true)}>Exportar todos (ZIP)</button></div></section>
    </div>
    <label className="preview-zoom-control">Escala do preview <input aria-label="Escala do preview" type="range" min="0.7" max="1" step="0.05" value={previewZoom} onChange={event => setPreviewZoom(Number(event.target.value))} /><output>{Math.round(previewZoom * 100)}%</output></label>
  </main>
}

type Workspace = 'tweet-card' | 'creative-studio'
const ACTIVE_WORKSPACE_KEY = 'inest-active-workspace'

function restoreWorkspace(): Workspace {
  const saved = sessionStorage.getItem(ACTIVE_WORKSPACE_KEY)
  return saved === 'creative-studio' || saved === 'tweet-card' ? saved : 'tweet-card'
}

export default function App() {
  const [workspace, setWorkspace] = useState<Workspace>(restoreWorkspace)
  useEffect(() => {
    sessionStorage.setItem(ACTIVE_WORKSPACE_KEY, workspace)
    console.info('[creative-observability]', 'workspace:active', { workspace })
  }, [workspace])
  return <div className="inest-workspace">
    <nav className="inest-workspace-switcher" aria-label="iNest creation workspace">
      <button
        type="button"
        aria-pressed={workspace === 'tweet-card'}
        onClick={() => setWorkspace('tweet-card')}
      >
        Tweet Card
      </button>
      <button
        type="button"
        aria-pressed={workspace === 'creative-studio'}
        onClick={() => setWorkspace('creative-studio')}
      >
        Creative Studio
      </button>
    </nav>
    <div className="inest-workspace-content">
      {workspace === 'tweet-card' ? <TweetCardApp /> : <CreativeStudioApp />}
    </div>
  </div>
}
