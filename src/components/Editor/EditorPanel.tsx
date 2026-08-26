import { useRef, type ChangeEvent } from 'react'
import type { Template, TweetSlide } from '../../types/project'
import { MediaEditor } from './MediaEditor'

type ProfileEditorProps = { avatarSrc: string; onAvatarChange: (src: string) => void; onAvatarReset: () => void }

function ProfileEditor({ avatarSrc, onAvatarChange, onAvatarReset }: ProfileEditorProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && /^(image\/png|image\/jpeg|image\/webp)$/.test(file.type)) {
      const reader = new FileReader()
      reader.onload = () => { if (typeof reader.result === 'string') onAvatarChange(reader.result) }
      reader.readAsDataURL(file)
    }
    event.target.value = ''
  }
  return <div className="profile-editor"><div className="profile-editor-preview"><img src={avatarSrc} alt="Foto de perfil atual" /></div><div className="profile-editor-actions"><input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={handleFile} /><button type="button" className="button secondary" onClick={() => inputRef.current?.click()}>Alterar foto</button><button type="button" className="text-button" onClick={onAvatarReset}>Restaurar padrão</button></div></div>
}

export function EditorPanel({ slide, update, avatarSrc, onAvatarChange, onAvatarReset }: { slide: TweetSlide; update: (patch: Partial<TweetSlide>) => void; avatarSrc: string; onAvatarChange: (src: string) => void; onAvatarReset: () => void }) {
  const field = (key: 'headline' | 'body' | 'cta', label: string, placeholder: string) => <label className="field"><span>{label}</span><textarea value={slide[key]} placeholder={placeholder} onChange={e => update({ [key]: e.target.value })} /></label>
  return <div className="editor-panel"><section className="editor-section"><h2>Conteúdo</h2><ProfileEditor avatarSrc={avatarSrc} onAvatarChange={onAvatarChange} onAvatarReset={onAvatarReset} /><label className="field"><span>Modelo</span><select value={slide.template} onChange={e => update({ template: e.target.value as Template })}><option value="cover">Capa</option><option value="content">Conteúdo</option><option value="final">Final</option></select></label><div className="style-controls"><span>Visual</span><div><button className={'style-button ' + ((slide.theme ?? 'dark') === 'dark' ? 'selected' : '')} onClick={() => update({ theme: 'dark' })}>Fundo escuro</button><button className={'style-button ' + (slide.theme === 'light' ? 'selected' : '')} onClick={() => update({ theme: 'light' })}>Fundo claro</button></div></div><label className="field font-control"><span>Tamanho do texto</span><div><button className="style-button" onClick={() => update({ fontScale: Math.max(.85, (slide.fontScale ?? 1) - .05) })}>A−</button><output>{Math.round((slide.fontScale ?? 1) * 100)}%</output><button className="style-button" onClick={() => update({ fontScale: Math.min(1.15, (slide.fontScale ?? 1) + .05) })}>A+</button></div></label>{field('headline', 'Headline', '🍎 SALVA ESSAS DATAS.')}{field('body', 'Corpo', 'Seu texto aqui…')}{field('cta', 'CTA', 'Arraste para o lado 👉')}</section><MediaEditor media={slide.media} overlay={slide.mediaTextOverlay} setOverlay={mediaTextOverlay => update({ mediaTextOverlay })} add={item => update({ media: [...slide.media, item].slice(0, 2) })} remove={id => update({ media: slide.media.filter(item => item.id !== id) })} update={(id, patch) => update({ media: slide.media.map(item => item.id === id ? { ...item, ...patch } : item) })} /></div>
}
