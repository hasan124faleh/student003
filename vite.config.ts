import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // تغيير المسار إلى مسار نسبي يمنع أخطاء 404 نهائياً
})
