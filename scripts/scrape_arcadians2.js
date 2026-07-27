const { chromium } = require("/home/ubuntu/wallet/node_modules/playwright-core");
const fs = require("fs");
(async () => {
  const browser = await chromium.launch({ 
    headless: true,
    executablePath: "/home/ubuntu/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell"
  });
  const page = await browser.newPage();
  
  await page.goto("https://arcadiansnft.com/", { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(5000);
  
  // Scroll
  await page.evaluate(async () => {
    for (let i = 0; i < document.body.scrollHeight; i += 500) {
      window.scrollTo(0, i);
      await new Promise(r => setTimeout(r, 100));
    }
  });
  await page.waitForTimeout(3000);
  
  // Get ALL stylesheets content
  const cssSheets = await page.evaluate(() => {
    return [...document.querySelectorAll("link[rel='stylesheet']")].map(l => ({ href: l.href }));
  });
  console.log("===CSS_SHEETS===" + JSON.stringify(cssSheets, null, 2).slice(0, 5000));
  console.log("===END_CSS_SHEETS===");
  
  // Capture screenshot
  await page.screenshot({ path: "/tmp/arcadians_home.png", fullPage: true });
  
  // Get computed theme variables
  const themeVars = await page.evaluate(() => {
    const root = document.documentElement;
    const s = getComputedStyle(root);
    return Object.fromEntries([...root.style].map(k => [k, s.getPropertyValue(k).trim()]));
  });
  console.log("===THEME===" + JSON.stringify(themeVars).slice(0, 8000));
  console.log("===END_THEME===");
  
  // Get all section info
  const sections = await page.evaluate(() => {
    return [...document.querySelectorAll('section, main > div, [class*="section"], article')].map((sec, i) => ({
      index: i,
      text: sec.innerText.slice(0, 300),
      classes: sec.className.slice(0, 200),
      tag: sec.tagName
    })).filter(s => s.text.trim());
  });
  console.log("===SECTIONS===" + JSON.stringify(sections, null, 2).slice(0, 15000));
  console.log("===END_SECTIONS===");
  
  // Get JS modules loaded
  const jsModules = await page.evaluate(() => {
    return [...document.querySelectorAll("script[src]")].map(s => s.src).filter(Boolean);
  });
  console.log("===JSMODULES===" + JSON.stringify(jsModules).slice(0, 5000));
  console.log("===END_JSMODULES===");
  
  // Viewport size & device metrics
  const viewport = await page.evaluate(() => ({
    w: window.innerWidth, h: window.innerHeight,
    dpr: window.devicePixelRatio,
    ua: navigator.userAgent
  }));
  console.log("===VIEWPORT===" + JSON.stringify(viewport));
  console.log("===END_VIEWPORT===");
  
  await browser.close();
  
  console.log("\n\nScreenshot saved to /tmp/arcadians_home.png");
})();
