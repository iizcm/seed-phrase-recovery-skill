const { chromium } = require("/home/ubuntu/wallet/node_modules/playwright-core");
const fs = require("fs");
const https = require("https");
const http = require("http");
const path = require("path");

const OUTDIR = "/tmp/arcadians_assets";
if (!fs.existsSync(OUTDIR)) fs.mkdirSync(OUTDIR, { recursive: true });

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        resolve(downloadFile(res.headers.location, dest));
        return;
      }
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
      file.on('error', reject);
    }).on('error', reject);
  });
}

(async () => {
  const browser = await chromium.launch({ 
    headless: true,
    executablePath: "/home/ubuntu/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell"
  });
  const page = await browser.newPage();
  
  // Get CSS URLs
  const cssUrls = await page.evaluate(() => {
    return [...document.querySelectorAll("link[rel='stylesheet']")].map(l => l.href).filter(Boolean);
  });
  console.log("CSS:", JSON.stringify(cssUrls));
  
  // Download CSS files
  for (const url of cssUrls) {
    const filename = url.split('/').pop().split('?')[0] || 'styles.css';
    const dest = path.join(OUTDIR, filename);
    try {
      await downloadFile(url, dest);
      console.log("Downloaded CSS:", filename, fs.statSync(dest).size);
    } catch(e) {
      console.log("Failed CSS:", url, e.message.slice(0, 80));
    }
  }
  
  // Also fetch the main Tailwind CSS
  try {
    const r = await fetch("https://arcadiansnft.com/_next/static/chunks/1q0yl_7yl07x3.css");
    if (r.ok) {
      const buf = Buffer.from(await r.arrayBuffer());
      fs.writeFileSync(path.join(OUTDIR, "main_styles.css"), buf);
      console.log("Downloaded main CSS:", buf.length);
    }
  } catch(e) { console.log("CSS fetch error:", e.message.slice(0,100)); }
  
  // Download images
  const imgs = await page.evaluate(() => {
    return [...document.querySelectorAll("img, [srcset], meta[property$='image']")].map(el => {
      const src = el.getAttribute('src') || el.getAttribute('data-src') || '';
      const prop = el.getAttribute('property');
      let content = '';
      if (prop === 'og:image' || prop === 'twitter:image') {
        content = el.getAttribute('content') || '';
      } else if (el.tagName === 'META') {
        content = el.getAttribute('content') || '';
      }
      return { src, content };
    }).filter(i => i.src || i.content);
  });
  
  for (const img of imgs) {
    const urls = [img.src, img.content].filter(Boolean);
    for (const url of urls) {
      if (url.includes('next/image') || url.includes('_next')) continue;
      const base = path.basename(url.split('?')[0]);
      const dest = path.join(OUTDIR, base);
      if (!fs.existsSync(dest)) {
        try {
          await downloadFile(url, dest);
          console.log("Downloaded:", base, fs.statSync(dest).size);
        } catch(e) {}
      }
    }
  }
  
  // Download external font CSS
  try {
    const r = await fetch("https://arcadiansnft.com/favicon.png");
    if (r.ok) {
      const buf = Buffer.from(await r.arrayBuffer());
      fs.writeFileSync(path.join(OUTDIR, "favicon.png"), buf);
    }
  } catch(e) {}
  
  try {
    const r = await fetch("https://arcadiansnft.com/banner.jpg");
    if (r.ok) {
      const buf = Buffer.from(await r.arrayBuffer());
      fs.writeFileSync(path.join(OUTDIR, "banner.jpg"), buf);
    }
  } catch(e) {}
  
  // Screenshot at different breakpoints
  for (const w of [1920, 1280, 768]) {
    await page.setViewportSize({ width: w, height: 1080 });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `/tmp/arcadians_${w}px.png`, fullPage: true });
    console.log(`Screenshot @ ${w}px`);
  }
  
  // Scroll through entire page and screenshot each section
  await page.setViewportSize({ width: 1280, height: 9000 });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: '/tmp/arcadians_fullpage.png', fullPage: true });
  console.log("Full page screenshot saved");
  
  await browser.close();
})();
