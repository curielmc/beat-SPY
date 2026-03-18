import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import './style.css'
import { getCanonicalUrl } from './lib/url'

const canonicalUrl = typeof window !== 'undefined' ? getCanonicalUrl(window.location) : null
if (canonicalUrl) {
  window.location.replace(canonicalUrl)
}

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(router)

// Mount app immediately, auth initializes in background via router guard
app.mount('#app')
