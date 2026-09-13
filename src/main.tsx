import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/montserrat/600.css'
import '@fontsource/montserrat/700.css'
import '@fontsource/montserrat/800.css'
import App from './App'
import './styles/tokens.css'

const OBSERVABILITY_PREFIX = '[creative-observability]'
const activeCreativeRequests = new Set<string>()

function report(event: string, details: Record<string, unknown> = {}) {
  console.info(OBSERVABILITY_PREFIX, event, {
    at: new Date().toISOString(),
    workspace: sessionStorage.getItem('inest-active-workspace') ?? 'tweet-card',
    ...details,
  })
}

window.addEventListener('inest:creative-engine-request', (event) => {
  const detail = (event as CustomEvent<{ requestId: string; active: boolean }>).detail
  if (!detail?.requestId) return
  if (detail.active) activeCreativeRequests.add(detail.requestId)
  else activeCreativeRequests.delete(detail.requestId)
  report('creative-engine:activity', {
    requestId: detail.requestId,
    active: detail.active,
    activeRequests: activeCreativeRequests.size,
  })
})

window.addEventListener('beforeunload', () => report('page:beforeunload', { activeRequests: activeCreativeRequests.size }))
window.addEventListener('pagehide', (event) => report('page:hide', { persisted: event.persisted, activeRequests: activeCreativeRequests.size }))
window.addEventListener('pageshow', (event) => report('page:show', { persisted: event.persisted }))
window.addEventListener('error', (event) => report('window:error', { message: event.message }))
window.addEventListener('unhandledrejection', (event) => report('window:unhandledrejection', {
  name: event.reason instanceof Error ? event.reason.name : undefined,
  message: event.reason instanceof Error ? event.reason.message : String(event.reason),
}))

navigator.serviceWorker?.addEventListener('controllerchange', () => report('pwa:controllerchange'))

registerSW({
  immediate: true,
  onRegisteredSW: (swScriptUrl, registration) => {
    report('pwa:registered', { swScriptUrl, scope: registration?.scope })
    registration?.addEventListener('updatefound', () => {
      report('pwa:updatefound')
      const installing = registration.installing
      installing?.addEventListener('statechange', () => {
        report('pwa:statechange', {
          state: installing.state,
          waiting: registration.waiting === installing,
        })
      })
    })
  },
  onNeedRefresh: () => report('pwa:need-refresh'),
  onOfflineReady: () => report('pwa:offline-ready'),
  onRegisterError: (error) => report('pwa:registration-error', {
    name: error instanceof Error ? error.name : undefined,
    message: error instanceof Error ? error.message : String(error),
  }),
  onNeedReload: () => {
    if (activeCreativeRequests.size > 0) {
      report('pwa:reload-deferred', { activeRequests: activeCreativeRequests.size })
      return
    }
    report('pwa:reload')
    window.location.reload()
  },
})
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
