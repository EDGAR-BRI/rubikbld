import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { inject } from '@vercel/analytics'
import { router } from './router'
import './style.css'
import App from './App.vue'
import { setupOfflineIcons } from './plugins/icons'

// Registrar colección de iconos Lucide offline
setupOfflineIcons()

// Iniciar Vercel Web Analytics
inject({
  framework: 'vue',
})

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

app.mount('#app')
