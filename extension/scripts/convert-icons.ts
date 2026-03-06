import sharp from 'sharp';
import { mkdirSync, existsSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const sizes = [16, 32, 48, 128];
const outputDir = resolve(__dirname, '../public/icons');

if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true });
}

const color = '#4a90d9';

const robotSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}">
  <path d="M12 2a1 1 0 0 1 1 1v1h3a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-1v2h2v2H7v-2h2v-2H8a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h3V3a1 1 0 0 1 1-1zm-4 6a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm8 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm-4 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/>
</svg>`;

const aiBrainSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}">
  <path d="M12 2C8.5 2 6 4.5 6 7c0 1.5.5 2.8 1.4 3.8L6 12.2V15c0 1.1.9 2 2 2h1v3c0 1.1.9 2 2 2h2c1.1 0 2-.9 2-2v-3h1c1.1 0 2-.9 2-2v-2.8l-1.4-1.4c.9-1 1.4-2.3 1.4-3.8 0-2.5-2.5-5-6-5zm-2 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm6 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-3 4a2 2 0 1 1 0-4 2 2 0 0 1 0 4z"/>
</svg>`;

const selectedSvg = robotSvg;

async function convertSvgToPng(svgContent: string, size: number): Promise<Buffer> {
  return await sharp(Buffer.from(svgContent))
    .resize(size, size)
    .png()
    .toBuffer();
}

async function main() {
  console.log('开始转换图标...');
  
  for (const size of sizes) {
    const pngBuffer = await convertSvgToPng(selectedSvg, size);
    const outputPath = resolve(outputDir, `icon${size}.png`);
    
    writeFileSync(outputPath, pngBuffer);
    console.log(`✅ 已生成: icon${size}.png`);
  }
  
  console.log('\n🎉 所有图标转换完成！');
}

main().catch(console.error);
