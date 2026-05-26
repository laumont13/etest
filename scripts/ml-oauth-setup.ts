/**
 * ML OAuth setup script — run ONCE to get a user token.
 * Uses system Chrome to complete the OAuth flow headlessly.
 *
 * Usage:
 *   npx tsx scripts/ml-oauth-setup.ts
 *
 * After running, .ml-tokens.json will be created with valid tokens.
 * These tokens are used by the app automatically (getMLToken() in lib/ml-auth.ts).
 *
 * Token duration: 6 hours (auto-refreshed by the app).
 */

import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
import https from 'https';

// ── Config ──────────────────────────────────────────────────────────────────
const CLIENT_ID = process.env.MERCADOLIBRE_CLIENT_ID ?? '6910772765197531';
const CLIENT_SECRET = process.env.MERCADOLIBRE_CLIENT_SECRET ?? 'skmiuJ6nzfhRYhloO7zLQWMcrqFpInGK';
const REDIRECT_URI = process.env.MERCADOLIBRE_REDIRECT_URI ?? 'https://etest-six.vercel.app/api/mercadolibre/callback';

const TOKEN_FILE = path.join(process.cwd(), '.ml-tokens.json');

// ML test user (created in sandbox via API)
// To regenerate: POST https://api.mercadolibre.com/users/test_user?access_token=<app_token> with {"site_id":"MLA"}
const TEST_USER_EMAIL = 'test_user_4125564778809866104@testuser.com';
const TEST_USER_PASSWORD = 'XwC8uUCzMi';

// System Chrome path (Windows)
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

// ── Helpers ──────────────────────────────────────────────────────────────────
function post(url: string, body: Record<string, string>): Promise<any> {
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams(body).toString();
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'Content-Length': Buffer.byteLength(params),
      },
    }, res => {
      let data = '';
      res.on('data', (chunk: Buffer) => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { reject(new Error(`Parse error: ${data.slice(0, 200)}`)); }
      });
    });
    req.on('error', reject);
    req.write(params);
    req.end();
  });
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== ML OAuth Setup ===\n');
  console.log('CLIENT_ID:', CLIENT_ID);
  console.log('REDIRECT_URI:', REDIRECT_URI);
  console.log('TEST_USER:', TEST_USER_EMAIL);
  console.log('');

  const authUrl = `https://auth.mercadolibre.com.ar/authorization?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
  console.log('Auth URL:', authUrl.slice(0, 80) + '...');
  console.log('');

  console.log('Launching Chrome...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
  });

  let code: string | null = null;

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');

    // Monitor ALL URL changes (including the callback redirect)
    page.on('framenavigated', frame => {
      if (frame !== page.mainFrame()) return;
      const url = frame.url();
      console.log(`  [nav] → ${url.slice(0, 100)}`);
      if (url.includes('code=')) {
        try {
          const u = new URL(url);
          const c = u.searchParams.get('code');
          if (c) {
            code = c;
            console.log(`\n✓ Authorization code captured from navigation: ${c.slice(0, 20)}...`);
          }
        } catch { /* ignore */ }
      }
    });

    console.log('Navigating to ML authorization page...');
    await page.goto(authUrl, { waitUntil: 'networkidle2', timeout: 30_000 });
    await new Promise(r => setTimeout(r, 2000));

    // Step 1: Find email/username input and enter it
    console.log('Looking for username field...');
    const emailSelectors = ['input[name="user_id"]', 'input[type="email"]', 'input[type="text"][name*="user"]', '#user_id', 'input[placeholder*="mail"]', 'input[placeholder*="usuario"]'];
    let emailFilled = false;
    for (const sel of emailSelectors) {
      try {
        await page.waitForSelector(sel, { timeout: 3000 });
        await page.type(sel, TEST_USER_EMAIL, { delay: 50 });
        emailFilled = true;
        console.log(`  Username entered via: ${sel}`);
        break;
      } catch { /* try next selector */ }
    }

    if (!emailFilled) {
      // Try to find by looking at all visible inputs
      const inputs = await page.$$('input:not([type="hidden"]):not([type="submit"])');
      if (inputs.length > 0) {
        await inputs[0].type(TEST_USER_EMAIL, { delay: 50 });
        emailFilled = true;
        console.log('  Username entered via first input');
      }
    }

    if (!emailFilled) {
      throw new Error('Could not find username input field');
    }

    // Find and click continue/next button
    const submitSelectors = ['button[type="submit"]', '#action-complete', 'button.andes-button--loud', 'form button', '.continue-btn'];
    for (const sel of submitSelectors) {
      try {
        await page.click(sel);
        console.log(`  Clicked continue via: ${sel}`);
        break;
      } catch { /* try next */ }
    }

    await new Promise(r => setTimeout(r, 5000));

    // Debug: check what page we're on
    const afterEmailUrl = page.url();
    const afterEmailTitle = await page.title();
    console.log(`  After email submit — URL: ${afterEmailUrl.slice(0, 80)}`);
    console.log(`  After email submit — Title: ${afterEmailTitle}`);

    // Step 1b: Handle "choose verification method" page (Contraseña vs Email)
    if (afterEmailUrl.includes('/login/challenges') || afterEmailTitle.includes('verificación') || afterEmailTitle.includes('método')) {
      console.log('  Challenge page detected — selecting "Contraseña"...');
      // Try clicking the password option
      const challengeSelectors = [
        '[data-testid="password-option"]',
        'li[class*="password"]',
        'li:first-child',
        '.challenge-list li:first-child',
        '[aria-label*="contraseña" i]',
        '[aria-label*="password" i]',
      ];
      let clicked = false;
      for (const sel of challengeSelectors) {
        try {
          await page.click(sel);
          clicked = true;
          console.log(`  Selected challenge method via: ${sel}`);
          break;
        } catch { /* try next */ }
      }
      if (!clicked) {
        // Try clicking any element containing "Contraseña" text
        const found = await page.evaluate(() => {
          const els = Array.from(document.querySelectorAll('li, button, a, div[role="button"]'));
          const el = els.find(e => (e as HTMLElement).innerText?.includes('Contraseña') || (e as HTMLElement).innerText?.includes('contraseña'));
          if (el) { (el as HTMLElement).click(); return true; }
          return false;
        });
        if (found) {
          console.log('  Selected "Contraseña" via text search');
          clicked = true;
        }
      }
      if (!clicked) {
        console.log('  Warning: could not click challenge option, proceeding anyway...');
      }
      await new Promise(r => setTimeout(r, 3000));
    }

    // Step 2: Password field
    console.log('Looking for password field...');
    const passwordSelectors = ['input[type="password"]', 'input[name="password"]', '#password', 'input[placeholder*="contraseña"]', 'input[placeholder*="password"]', 'input[autocomplete="current-password"]'];
    let passFilled = false;
    for (const sel of passwordSelectors) {
      try {
        await page.waitForSelector(sel, { timeout: 8000 });
        await page.type(sel, TEST_USER_PASSWORD, { delay: 50 });
        passFilled = true;
        console.log(`  Password entered via: ${sel}`);
        break;
      } catch { /* try next selector */ }
    }

    if (!passFilled) {
      // Dump visible inputs for debugging
      const allInputs = await page.$$eval('input', (inputs: HTMLInputElement[]) =>
        inputs.map(i => ({ type: i.type, name: i.name, id: i.id, placeholder: i.placeholder }))
      );
      console.log('  Visible inputs:', JSON.stringify(allInputs));

      const inputs = await page.$$('input:not([type="hidden"]):not([type="submit"])');
      for (const inp of inputs) {
        const props = await page.evaluate((el: Element) => ({
          type: (el as HTMLInputElement).type,
          name: (el as HTMLInputElement).name,
        }), inp);
        if (props.type === 'password' || props.type === 'text') {
          await inp.type(TEST_USER_PASSWORD, { delay: 50 });
          passFilled = true;
          console.log(`  Password entered via fallback (type=${props.type}, name=${props.name})`);
          break;
        }
      }
    }

    if (!passFilled) {
      const pageContent = await page.evaluate(() => document.body?.innerText?.slice(0, 500));
      console.log('Page content:', pageContent);
      throw new Error('Could not find password field');
    }

    // Submit login
    const submitPwSelectors = ['button[type="submit"]', '#action-complete', 'button.andes-button--loud'];
    for (const sel of submitPwSelectors) {
      try {
        await page.click(sel);
        console.log(`  Login submitted via: ${sel}`);
        break;
      } catch { /* try next */ }
    }

    // Wait for post-login navigation
    await new Promise(r => setTimeout(r, 4000));

    // Check if we're on the authorization approval page
    const preApproveUrl = page.url();
    const preApproveTitle = await page.title();
    console.log(`  Pre-approve URL: ${preApproveUrl.slice(0, 80)}`);
    console.log(`  Pre-approve Title: ${preApproveTitle}`);

    if (!code) {
      console.log('Looking for authorization approval button...');
      // ML auth approval page usually has a green "Autorizar" button
      const approveSelectors = [
        'button[name="allow"]',
        'input[name="allow"]',
        'button[value="allow"]',
        '[data-testid="authorize-button"]',
        'button.andes-button--loud',
        'form[method="post"] button[type="submit"]',
      ];

      let approved = false;
      for (const sel of approveSelectors) {
        try {
          await page.click(sel);
          approved = true;
          console.log(`  Approved via: ${sel}`);
          break;
        } catch { /* try next */ }
      }

      if (!approved) {
        // Try clicking button with "Autorizar" or "Permitir" text
        approved = await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], a'));
          const btn = buttons.find(b => {
            const txt = ((b as HTMLElement).innerText ?? (b as HTMLInputElement).value ?? '').toLowerCase();
            return txt.includes('autorizar') || txt.includes('permitir') || txt.includes('allow') || txt.includes('continuar');
          });
          if (btn) { (btn as HTMLElement).click(); return true; }
          return false;
        });
        if (approved) console.log('  Approved via text-search button click');
      }

      if (!approved) {
        const bodyContent = await page.evaluate(() => document.body?.innerText?.slice(0, 800));
        console.log('  Authorization page content:', bodyContent);
      } else {
        // Try to also submit the form directly
        await page.evaluate(() => {
          const forms = document.querySelectorAll('form');
          if (forms.length > 0) (forms[0] as HTMLFormElement).submit();
        });
      }

      // Wait for redirect after approval
      await new Promise(r => setTimeout(r, 8000));

      // If still not captured, try clicking any visible buttons and dump debug info
      if (!code) {
        const buttons = await page.$$eval('button, input[type="submit"]', (btns: Element[]) =>
          btns.map(b => ({ text: (b as HTMLElement).innerText, type: (b as HTMLInputElement).type, name: (b as HTMLInputElement).name, value: (b as HTMLInputElement).value }))
        );
        console.log('  Buttons on page:', JSON.stringify(buttons.slice(0, 5)));

        // Try clicking any form submit
        for (const btn of buttons) {
          if (btn.text?.toLowerCase().includes('autorizar') || btn.text?.toLowerCase().includes('permitir') || btn.name === 'allow' || btn.value === 'allow') {
            const el = await page.$(`button:has-text("${btn.text?.slice(0, 10)}")`).catch(() => null);
            if (el) {
              await el.click();
              await new Promise(r => setTimeout(r, 5000));
              break;
            }
          }
        }
      }
    }

    // Final wait for code capture
    await new Promise(r => setTimeout(r, 3000));

    // If code still not captured, try from page URL
    if (!code) {
      const currentUrl = page.url();
      console.log('Current page URL:', currentUrl.slice(0, 100));
      if (currentUrl.includes('code=')) {
        const u = new URL(currentUrl);
        code = u.searchParams.get('code');
        console.log(`Code from URL: ${code?.slice(0, 20)}...`);
      }
    }

    if (!code) {
      // Dump page content for debugging
      const title = await page.title();
      console.log('Page title:', title);
      const bodyText = await page.evaluate(() => document.body?.innerText?.slice(0, 500));
      console.log('Page content:', bodyText);
      throw new Error('Authorization code not obtained. Check if ML login succeeded.');
    }

  } finally {
    await browser.close();
  }

  // Exchange code for tokens
  console.log('\nExchanging code for tokens...');
  const tokenData = await post('https://api.mercadolibre.com/oauth/token', {
    grant_type: 'authorization_code',
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    code: code,
    redirect_uri: REDIRECT_URI,
  });

  if (!tokenData.access_token) {
    console.error('Token exchange failed:', JSON.stringify(tokenData));
    process.exit(1);
  }

  const tokens = {
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token ?? '',
    expires_at: Date.now() + ((tokenData.expires_in ?? 21600) - 300) * 1000,
  };

  fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2), 'utf8');
  console.log('\n✓ Tokens guardados en .ml-tokens.json');
  console.log(`  access_token: ${tokens.access_token.slice(0, 40)}...`);
  console.log(`  expires_at:   ${new Date(tokens.expires_at).toISOString()}`);
  console.log('');
  console.log('Ahora el app puede buscar en ML. Reiniciá el servidor si está corriendo.');
}

main().catch(err => {
  console.error('\n✗ Error:', err.message ?? err);
  process.exit(1);
});
