const { chromium } = require("/home/ubuntu/wallet/node_modules/playwright-core");
const fs = require("fs");
(async () => {
  const browser = await chromium.launch({ 
    headless: true,
    executablePath: "/home/ubuntu/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell"
  });
  const page = await browser.newPage();
  
  await page.goto("https://arcadiansnft.com/", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(5000);
  
  // Scroll to load everything
  await page.evaluate(async () => {
    for (let i = 0; i < document.body.scrollHeight; i += 500) {
      window.scrollTo(0, i);
      await new Promise(r => setTimeout(r, 100));
    }
  });
  await page.waitForTimeout(3000);
  
  // Full text content of the page
  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log("===BODY_TEXT===" + bodyText.length + "===");
  console.log(bodyText);
  console.log("===END_BODY_TEXT===");
  
  // All links
  const links = await page.evaluate(() => {
    return [...document.querySelectorAll("a")].map(a => ({
      href: a.href,
      text: a.textContent.trim().slice(0, 100)
    })).filter(l => l.text || l.href !== '#');
  });
  console.log("===LINKS===" + JSON.stringify(links, null, 2).slice(0, 10000));
  console.log("===END_LINKS===");
  
  // Images
  const imgs = await page.evaluate(() => {
    return [...document.querySelectorAll("img")].map(i => ({
      src: i.src || i.getAttribute("data-src"),
      alt: i.alt,
      width: i.width, height: i.height
    }));
  });
  console.log("===IMAGES===" + JSON.stringify(imgs, null, 2).slice(0, 5000));
  console.log("===END_IMAGES===");
  
  // All CSS classes used (for design analysis)
  const classes = await page.evaluate(() => {
    const allClasses = new Set();
    document.querySelectorAll("*").forEach(el => {
      el.classList.forEach(c => allClasses.add(c));
    });
    return [...allClasses].sort();
  });
  console.log("===CLASSES===" + JSON.stringify(classes).slice(0, 15000));
  console.log("===END_CLASSES===");
  
  // Inline styles & CSS (from style tags and head)
  const cssContent = await page.evaluate(() => {
    let css = "";
    document.querySelectorAll("style").forEach(s => { css += s.textContent + "\n" });
    document.querySelectorAll("link[rel='stylesheet']").forEach(l => { css += "@import:" + l.href + "\n"; });
    return css;
  });
  console.log("===CSS===" + cssContent.length + "===");
  console.log(cssContent.slice(0, 20000));
  console.log("===END_CSS===");
  
  await browser.close();
})();
