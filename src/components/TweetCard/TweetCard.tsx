import type { TweetSlide } from '../../types/project'
import { TweetHeader } from './TweetHeader'
import { TweetMedia } from './TweetMedia'

export function TweetCard({ slide, exportMode = false, onMediaAdjust }: { slide: TweetSlide; exportMode?: boolean; onMediaAdjust?: (id: string, patch: Partial<TweetSlide['media'][number]>) => void }) {
  const text = slide.headline.trim() || (exportMode ? '' : 'Seu título aparece aqui')
  return <article className={'tweet-card template-' + slide.template} aria-label="Preview do Tweet Card">
    <TweetHeader />
    <div className="tweet-copy">
      {text && <h1 className={slide.headline.trim() ? '' : 'placeholder'}>{text}</h1>}
      {slide.body && <p className="tweet-body">{slide.body}</p>}
      {slide.cta && <p className="tweet-cta">{slide.cta}</p>}
    </div>
    <TweetMedia media={slide.media} overlay={slide.mediaTextOverlay} onMediaAdjust={onMediaAdjust} />
  </article>
}
