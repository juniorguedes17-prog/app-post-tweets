export type Template = 'cover' | 'content' | 'final'
export type CardTheme = 'dark' | 'light'
export type MediaItem = { id: string; src: string; zoom: number; cropX: number; cropY: number }
export type TweetSlide = { id: string; template: Template; headline: string; body: string; cta: string; mediaTextOverlay: boolean; media: MediaItem[]; theme: CardTheme; fontScale: number }
export type TweetProject = { id: string; title: string; slides: TweetSlide[]; activeSlideId: string; updatedAt: number; profileAvatarSrc?: string }

export const DEFAULT_AVATAR_SRC = '/assets/avatar-paulo.png'

const uid = () => crypto.randomUUID()
export const blankSlide = (): TweetSlide => ({ id: uid(), template: 'cover', headline: '', body: '', cta: 'Arraste para o lado 👉', mediaTextOverlay: false, media: [], theme: 'dark', fontScale: 1 })
export const newProject = (): TweetProject => { const slide = blankSlide(); return { id: uid(), title: 'Meu carrossel', slides: [slide], activeSlideId: slide.id, updatedAt: Date.now() } }
