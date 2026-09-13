export type BrandedId<TName extends string> = string & { readonly __brand: TName }

export type CreativeProjectId = BrandedId<'CreativeProjectId'>
export type CreativeBriefId = BrandedId<'CreativeBriefId'>
export type CreativeAssetId = BrandedId<'CreativeAssetId'>
export type VisualReferenceId = BrandedId<'VisualReferenceId'>
export type CreativeDirectionId = BrandedId<'CreativeDirectionId'>
export type CompositionId = BrandedId<'CompositionId'>
export type CompositionRevisionId = BrandedId<'CompositionRevisionId'>
export type CompositionElementId = BrandedId<'CompositionElementId'>
export type CreativeDocumentId = BrandedId<'CreativeDocumentId'>
export type BrandProfileId = BrandedId<'BrandProfileId'>
export type GenerationId = BrandedId<'GenerationId'>
export type GenerationVariantId = BrandedId<'GenerationVariantId'>
export type ElementLockId = BrandedId<'ElementLockId'>

