# iNest Tweet Card Generator

Aplicação React/Vite/PWA local para criar cards 1080 × 1350 no estilo X Dark Mode.

## Primeiro passo obrigatório

O arquivo oficial **Foto Perfil Instagram.PNG** já foi copiado para `public/assets/avatar-paulo.png`. O aplicativo usa somente esse caminho como avatar fixo; imagens enviadas no editor nunca são usadas como avatar.

## Executar

```powershell
pnpm install
pnpm dev
```

## Incluído

- Card único reutilizado no preview e na exportação PNG (1080 × 1350).
- Editor mobile-first, carrosséis, duplicação, mídia única ou dividida, sliders e gestos touch/pinch para crop.
- IndexedDB para autosave local, exportação PNG com Share Sheet quando suportada e ZIP de todos os slides.
- Manifest, service worker e ícones PWA.

Todo conteúdo permanece no dispositivo.

As referências obrigatórias estão versionadas em `public/assets/references/` e mapeadas em `src/data/templateReferences.ts`.
