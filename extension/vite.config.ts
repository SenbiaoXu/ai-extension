import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, existsSync, readdirSync, statSync, rmSync, readFileSync, writeFileSync } from 'fs';

function copyDirectory(src: string, dest: string) {
  if (!existsSync(dest)) {
    mkdirSync(dest, { recursive: true });
  }
  const entries = readdirSync(src);
  for (const entry of entries) {
    const srcPath = resolve(src, entry);
    const destPath = resolve(dest, entry);
    if (statSync(srcPath).isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

function fixHtmlPaths(htmlPath: string) {
  if (!existsSync(htmlPath)) return;
  
  let content = readFileSync(htmlPath, 'utf-8');
  
  content = content.replace(/\.\.\/\.\.\/js\//g, '../js/');
  content = content.replace(/\.\.\/\.\.\/assets\//g, '../assets/');
  
  writeFileSync(htmlPath, content);
}

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        sidebar: resolve(__dirname, 'src/sidebar/index.html'),
        options: resolve(__dirname, 'src/options/index.html'),
        background: resolve(__dirname, 'src/background/index.ts'),
      },
      output: {
        entryFileNames: 'js/[name].js',
        chunkFileNames: 'js/[name]-[hash].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  plugins: [
    {
      name: 'copy-extension-files',
      closeBundle() {
        const distDir = resolve(__dirname, 'dist');
        
        if (!existsSync(distDir)) {
          mkdirSync(distDir, { recursive: true });
        }
        
        copyFileSync(
          resolve(__dirname, 'manifest.json'),
          resolve(distDir, 'manifest.json')
        );
        
        const iconsSrc = resolve(__dirname, 'public/icons');
        const iconsDest = resolve(distDir, 'icons');
        if (existsSync(iconsSrc)) {
          copyDirectory(iconsSrc, iconsDest);
        }

        const sidebarSrc = resolve(distDir, 'src/sidebar/index.html');
        const sidebarDest = resolve(distDir, 'sidebar/index.html');
        if (existsSync(sidebarSrc)) {
          mkdirSync(resolve(distDir, 'sidebar'), { recursive: true });
          copyFileSync(sidebarSrc, sidebarDest);
          fixHtmlPaths(sidebarDest);
        }

        const optionsSrc = resolve(distDir, 'src/options/index.html');
        const optionsDest = resolve(distDir, 'options/index.html');
        if (existsSync(optionsSrc)) {
          mkdirSync(resolve(distDir, 'options'), { recursive: true });
          copyFileSync(optionsSrc, optionsDest);
          fixHtmlPaths(optionsDest);
        }

        const srcDir = resolve(distDir, 'src');
        if (existsSync(srcDir)) {
          rmSync(srcDir, { recursive: true, force: true });
        }
      },
    },
  ],
});
