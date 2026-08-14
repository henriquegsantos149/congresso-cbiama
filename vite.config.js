import { defineConfig } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  plugins: [
    {
      name: 'rewrite-routes',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/pesquisa') req.url = '/pesquisa/';
          if (req.url === '/sp') req.url = '/sp/';
          if (req.url === '/brasil') req.url = '/brasil/';
          next();
        });
      }
    }
  ],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        sp: resolve(__dirname, 'sp/index.html'),
        brasil: resolve(__dirname, 'brasil/index.html'),
        pesquisa: resolve(__dirname, 'pesquisa/index.html')
      }
    }
  }
});
