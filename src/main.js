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

// Initialize auth store before mounting
import { useAuthStore } from './stores/auth'
const auth = useAuthStore()
auth.init().then(() => {
  app.mount('#app')
})
