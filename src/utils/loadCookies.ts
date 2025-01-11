import * as fs from 'fs';
import * as path from 'path';
import { BrowserContext } from 'playwright';

export function loadCookies(context: BrowserContext): void {
  const cookiesPath = path.resolve(process.cwd(), 'cookies.json');

  console.log('[INFO] Checking if cookies file exists...');
  console.log('Cookies file path:', cookiesPath);

  if (fs.existsSync(cookiesPath)) {
    const cookiesData = JSON.parse(fs.readFileSync(cookiesPath, 'utf-8'));

    // Pastikan cookiesData adalah array
    const cookiesArray = Array.isArray(cookiesData)
      ? cookiesData
      : Object.values(cookiesData);

    // Validasi format setiap cookie
    const formattedCookies = cookiesArray.map((cookie: any) => ({
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain,
      path: cookie.path || '/',
      httpOnly: cookie.httpOnly || false,
      secure: cookie.secure || false,
      sameSite: cookie.sameSite || 'None',
    }));

    context.addCookies(formattedCookies);
    console.log('[INFO] Cookies loaded successfully');
  } else {
    console.error('[ERROR] Cookies file not found');
  }
}
