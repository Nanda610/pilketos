/**
 * Pure helper functions for Print Preview, A4 Document Formatting,
 * Kop Logo Size Persistence, and Official Stamp/Signature Customization.
 */

export interface KopLogoSizeConfig {
  schoolLogoWidth: number;
  schoolLogoHeight: number;
  schoolLogoOffsetX: number;
  schoolLogoOffsetY: number;
  osisLogoWidth: number;
  osisLogoHeight: number;
  osisLogoOffsetX: number;
  osisLogoOffsetY: number;
  savedAt?: string;
}

export interface OfficialStampConfig {
  headerText: string;
  institutionText: string;
  footerText: string;
  sizePx: number;
  rotationDeg: number;
  offsetX: number;
  offsetY: number;
  colorTheme: 'purple' | 'blue' | 'emerald' | 'rose' | 'slate';
  signatoryTitle: string;
  savedAt?: string;
}

export const DEFAULT_KOP_LOGO_CONFIG: KopLogoSizeConfig = {
  schoolLogoWidth: 52,
  schoolLogoHeight: 78,
  schoolLogoOffsetX: 0,
  schoolLogoOffsetY: 0,
  osisLogoWidth: 52,
  osisLogoHeight: 78,
  osisLogoOffsetX: 0,
  osisLogoOffsetY: 0,
};

const KOP_LOGO_STORAGE_KEY = 'epilketos_kop_logo_size_v1';
const KOP_LOGO_PRESET_STORAGE_KEY = 'epilketos_kop_logo_custom_preset_v1';
const STAMP_CONFIG_STORAGE_KEY = 'epilketos_official_stamp_config_v1';

export function clampZoomScale(scale: number): number {
  if (Number.isNaN(scale)) return 100;
  return Math.min(150, Math.max(50, Math.round(scale / 5) * 5));
}

export function getPageBreakStyle(
  pageIndex: number,
  totalPages: number
): { pageBreakAfter: 'always' | 'auto'; breakAfter: 'page' | 'auto' } {
  const isLastPage = pageIndex >= totalPages - 1;
  return {
    pageBreakAfter: isLastPage ? 'auto' : 'always',
    breakAfter: isLastPage ? 'auto' : 'page',
  };
}

export function formatOfficialBahpNumber(
  schoolType: string,
  year: number = new Date().getFullYear()
): string {
  const cleanType = (schoolType || 'OSIS').trim().toUpperCase();
  return `078/BA-PILKETOS/${cleanType}/${year}`;
}

export function sanitizeLogoSizeConfig(
  input: Partial<KopLogoSizeConfig> | null | undefined
): KopLogoSizeConfig {
  const clampDim = (val: unknown, fallback: number, min: number, max: number) => {
    const n = typeof val === 'number' && !Number.isNaN(val) ? Math.round(val) : fallback;
    return Math.max(min, Math.min(max, n));
  };
  return {
    schoolLogoWidth: clampDim(input?.schoolLogoWidth, DEFAULT_KOP_LOGO_CONFIG.schoolLogoWidth, 20, 220),
    schoolLogoHeight: clampDim(input?.schoolLogoHeight, DEFAULT_KOP_LOGO_CONFIG.schoolLogoHeight, 20, 320),
    schoolLogoOffsetX: clampDim(input?.schoolLogoOffsetX, DEFAULT_KOP_LOGO_CONFIG.schoolLogoOffsetX, -120, 120),
    schoolLogoOffsetY: clampDim(input?.schoolLogoOffsetY, DEFAULT_KOP_LOGO_CONFIG.schoolLogoOffsetY, -80, 80),
    osisLogoWidth: clampDim(input?.osisLogoWidth, DEFAULT_KOP_LOGO_CONFIG.osisLogoWidth, 20, 220),
    osisLogoHeight: clampDim(input?.osisLogoHeight, DEFAULT_KOP_LOGO_CONFIG.osisLogoHeight, 20, 320),
    osisLogoOffsetX: clampDim(input?.osisLogoOffsetX, DEFAULT_KOP_LOGO_CONFIG.osisLogoOffsetX, -120, 120),
    osisLogoOffsetY: clampDim(input?.osisLogoOffsetY, DEFAULT_KOP_LOGO_CONFIG.osisLogoOffsetY, -80, 80),
    savedAt: input?.savedAt,
  };
}

export function areLogoConfigsEqual(a: KopLogoSizeConfig, b: KopLogoSizeConfig): boolean {
  return (
    a.schoolLogoWidth === b.schoolLogoWidth &&
    a.schoolLogoHeight === b.schoolLogoHeight &&
    a.schoolLogoOffsetX === b.schoolLogoOffsetX &&
    a.schoolLogoOffsetY === b.schoolLogoOffsetY &&
    a.osisLogoWidth === b.osisLogoWidth &&
    a.osisLogoHeight === b.osisLogoHeight &&
    a.osisLogoOffsetX === b.osisLogoOffsetX &&
    a.osisLogoOffsetY === b.osisLogoOffsetY
  );
}

export function loadSavedKopLogoConfig(fallback?: Partial<KopLogoSizeConfig>): KopLogoSizeConfig {
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(KOP_LOGO_STORAGE_KEY);
      if (raw) {
        return sanitizeLogoSizeConfig(JSON.parse(raw));
      }
    } catch {
      // Fallback to default
    }
  }
  return sanitizeLogoSizeConfig(fallback);
}

export function saveKopLogoConfig(config: Partial<KopLogoSizeConfig>): KopLogoSizeConfig {
  const sanitized = sanitizeLogoSizeConfig({
    ...config,
    savedAt: new Date().toISOString(),
  });
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(KOP_LOGO_STORAGE_KEY, JSON.stringify(sanitized));
    } catch {
      // Ignore storage errors
    }
  }
  return sanitized;
}

export function saveCustomKopLogoPreset(config: Partial<KopLogoSizeConfig>): KopLogoSizeConfig {
  const sanitized = sanitizeLogoSizeConfig({
    ...config,
    savedAt: new Date().toISOString(),
  });
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(KOP_LOGO_PRESET_STORAGE_KEY, JSON.stringify(sanitized));
    } catch {
      // Ignore storage errors
    }
  }
  return sanitized;
}

export function loadCustomKopLogoPreset(): KopLogoSizeConfig | null {
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(KOP_LOGO_PRESET_STORAGE_KEY);
      if (raw) {
        return sanitizeLogoSizeConfig(JSON.parse(raw));
      }
    } catch {
      // Ignore errors
    }
  }
  return null;
}

export function createDefaultStampConfig(schoolName: string): OfficialStampConfig {
  return {
    headerText: '★ PEMERINTAH ★',
    institutionText: schoolName || 'SATUAN PENDIDIKAN',
    footerText: 'KEPALA SEKOLAH',
    sizePx: 96,
    rotationDeg: -12,
    offsetX: -8,
    offsetY: 0,
    colorTheme: 'purple',
    signatoryTitle: `KEPALA ${(schoolName || 'SATUAN PENDIDIKAN').toUpperCase()}`,
  };
}

export function sanitizeStampConfig(
  input: Partial<OfficialStampConfig> | null | undefined,
  schoolName: string
): OfficialStampConfig {
  const defaults = createDefaultStampConfig(schoolName);
  const clampNum = (val: unknown, fallback: number, min: number, max: number) => {
    const n = typeof val === 'number' && !Number.isNaN(val) ? Math.round(val) : fallback;
    return Math.max(min, Math.min(max, n));
  };
  const validThemes: OfficialStampConfig['colorTheme'][] = ['purple', 'blue', 'emerald', 'rose', 'slate'];
  const theme = validThemes.includes(input?.colorTheme as OfficialStampConfig['colorTheme'])
    ? (input?.colorTheme as OfficialStampConfig['colorTheme'])
    : defaults.colorTheme;

  return {
    headerText: typeof input?.headerText === 'string' && input.headerText.trim() ? input.headerText.trim() : defaults.headerText,
    institutionText: typeof input?.institutionText === 'string' && input.institutionText.trim() ? input.institutionText.trim() : defaults.institutionText,
    footerText: typeof input?.footerText === 'string' && input.footerText.trim() ? input.footerText.trim() : defaults.footerText,
    sizePx: clampNum(input?.sizePx, defaults.sizePx, 64, 150),
    rotationDeg: clampNum(input?.rotationDeg, defaults.rotationDeg, -45, 45),
    offsetX: clampNum(input?.offsetX, defaults.offsetX, -80, 80),
    offsetY: clampNum(input?.offsetY, defaults.offsetY, -60, 60),
    colorTheme: theme,
    signatoryTitle: typeof input?.signatoryTitle === 'string' && input.signatoryTitle.trim() ? input.signatoryTitle.trim() : defaults.signatoryTitle,
    savedAt: input?.savedAt,
  };
}

export function loadSavedStampConfig(
  schoolName: string,
  fallback?: Partial<OfficialStampConfig>
): OfficialStampConfig {
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(STAMP_CONFIG_STORAGE_KEY);
      if (raw) {
        return sanitizeStampConfig(JSON.parse(raw), schoolName);
      }
    } catch {
      // Fallback
    }
  }
  return sanitizeStampConfig(fallback, schoolName);
}

export function saveStampConfig(
  config: Partial<OfficialStampConfig>,
  schoolName: string
): OfficialStampConfig {
  const sanitized = sanitizeStampConfig(
    {
      ...config,
      savedAt: new Date().toISOString(),
    },
    schoolName
  );
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STAMP_CONFIG_STORAGE_KEY, JSON.stringify(sanitized));
    } catch {
      // Ignore storage errors
    }
  }
  return sanitized;
}
