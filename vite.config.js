import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
    server: {
      port: 5174,
      proxy: {
        '/tmdb-api': {
          target: 'https://api.themoviedb.org/3',
          changeOrigin: true,
          rewrite: path => path.replace(/^\/tmdb-api/, ''),
          headers: {
            Authorization: `Bearer ${env.TMDB_ACCESS_TOKEN || ''}`,
            Accept: 'application/json',
          },
        },
        '/omdb-api': {
          target: 'http://www.omdbapi.com',
          changeOrigin: true,
          rewrite: path => path.replace(/^\/omdb-api/, '') + `&apikey=${env.OMDB_API_KEY || ''}`,
        },
      },
    },
  }
})
