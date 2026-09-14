import type {
  BrandPresence,
  CompositionStrategy,
  CreativeObjective,
  CreativeStyle,
} from './domain/creativeBrief'
import type { CreativeAssetKind } from './domain/creativeAsset'
import type { CanvasFormat } from './domain/canvas'
import type { LockScope } from './domain/locks'
import type { CompositionElementType, SemanticRole } from './domain/sceneGraph'

const labels = <T extends string>(values: Record<string, string>, value: T) => values[value] ?? value

export const creativeObjectiveLabel = (value: CreativeObjective) => labels({
  'stop-scroll': 'Parar o scroll',
  comments: 'Comentários',
  shares: 'Compartilhamentos',
  authority: 'Autoridade',
  conversion: 'Conversão',
  desire: 'Gerar desejo',
}, value)

export const creativeStyleLabel = (value: CreativeStyle) => labels({
  'native-ugc': 'UGC nativo',
  tweet: 'Tweet',
  editorial: 'Editorial',
  product: 'Produto',
  lifestyle: 'Lifestyle',
  storytelling: 'Storytelling',
}, value)

export const compositionStrategyLabel = (value: CompositionStrategy) => labels({
  auto: 'Automática',
  centered: 'Centralizada',
  asymmetric: 'Assimétrica',
  'photo-dominant': 'Foto dominante',
  'typography-dominant': 'Tipografia dominante',
}, value)

export const brandPresenceLabel = (value: BrandPresence) => labels({
  minimal: 'Minimal',
  normal: 'Normal',
  none: 'Sem assinatura',
}, value)

export const canvasFormatLabel = (value: CanvasFormat) => labels({
  'feed-4-5': 'Feed 4:5',
  'story-9-16': 'Stories 9:16',
  'square-1-1': 'Quadrado 1:1',
  'tweet-card': 'Tweet Card',
  custom: 'Personalizado',
}, value)

export const assetKindLabel = (value: CreativeAssetKind) => labels({
  image: 'Imagem',
  photo: 'Foto',
  product: 'Produto',
  logo: 'Logo',
  reference: 'Referência',
}, value)

export const semanticRoleLabel = (value: SemanticRole) => labels({
  headline: 'Título',
  body: 'Texto de apoio',
  cta: 'CTA',
  product: 'Produto',
  photo: 'Foto',
  logo: 'Logo',
  annotation: 'Anotação',
  background: 'Fundo',
  decoration: 'Decoração',
}, value)

export const compositionElementTypeLabel = (value: CompositionElementType) => labels({
  text: 'Texto',
  image: 'Imagem',
  photo: 'Foto',
  product: 'Produto',
  logo: 'Logo',
  shape: 'Forma',
  annotation: 'Anotação',
  group: 'Grupo',
}, value)

export const lockScopeLabel = (value: LockScope) => labels({
  content: 'conteúdo',
  asset: 'imagem',
  position: 'posição',
  dimensions: 'dimensões',
  crop: 'recorte',
  scale: 'escala',
  style: 'estilo',
  element: 'elemento',
}, value)
