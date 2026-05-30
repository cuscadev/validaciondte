const SYSTEM_FONT_STACK = 'ui-sans-serif, system-ui, sans-serif';

const GOOGLE_FONTS_HOST = 'fonts.googleapis.com';

function decodeFamilyName(raw: string): string {
  const decoded = decodeURIComponent(raw.replace(/\+/g, ' ')).trim();
  if (!decoded) return '';
  return decoded.includes(' ') ? `"${decoded}"` : decoded;
}

/** Extrae la primera familia del parámetro `family=` en una URL de Google Fonts. */
export function parseFontFamilyFromGoogleFontsUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const families = parsed.searchParams.getAll('family');
    if (families.length === 0) return null;

    const first = families[0];
    const namePart = first.split(':')[0];
    const family = decodeFamilyName(namePart);
    return family || null;
  } catch {
    return null;
  }
}

function isValidGoogleFontsUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.hostname === GOOGLE_FONTS_HOST;
  } catch {
    return false;
  }
}

export type AppFontConfig = {
  googleFontsUrl: string | null;
  fontFamily: string;
  cssVariable: string;
};

export function getAppFontConfig(): AppFontConfig {
  const raw = process.env.NEXT_PUBLIC_GOOGLE_FONTS_URL?.trim() ?? '';
  const googleFontsUrl = raw && isValidGoogleFontsUrl(raw) ? raw : null;
  const parsedFamily = googleFontsUrl
    ? parseFontFamilyFromGoogleFontsUrl(googleFontsUrl)
    : null;
  const fontFamily = parsedFamily
    ? `${parsedFamily}, ${SYSTEM_FONT_STACK}`
    : SYSTEM_FONT_STACK;

  return {
    googleFontsUrl,
    fontFamily,
    cssVariable: fontFamily,
  };
}
