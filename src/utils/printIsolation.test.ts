import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clampZoomScale,
  getPageBreakStyle,
  formatOfficialBahpNumber,
  sanitizeLogoSizeConfig,
  areLogoConfigsEqual,
  DEFAULT_KOP_LOGO_CONFIG,
  sanitizeStampConfig,
} from './printIsolation';

test('clampZoomScale constrains zoom between 50% and 150%', () => {
  assert.equal(clampZoomScale(100), 100);
  assert.equal(clampZoomScale(30), 50);
  assert.equal(clampZoomScale(200), 150);
  assert.equal(clampZoomScale(NaN), 100);
});

test('getPageBreakStyle prevents trailing blank page on final page', () => {
  assert.deepEqual(getPageBreakStyle(0, 3), { pageBreakAfter: 'always', breakAfter: 'page' });
  assert.deepEqual(getPageBreakStyle(1, 3), { pageBreakAfter: 'always', breakAfter: 'page' });
  assert.deepEqual(getPageBreakStyle(2, 3), { pageBreakAfter: 'auto', breakAfter: 'auto' });
});

test('formatOfficialBahpNumber formats legal minutes number', () => {
  assert.equal(formatOfficialBahpNumber('OSIS', 2026), '078/BA-PILKETOS/OSIS/2026');
  assert.equal(formatOfficialBahpNumber('osim', 2027), '078/BA-PILKETOS/OSIM/2027');
});

test('sanitizeLogoSizeConfig clamps dimensions and offsets safely', () => {
  const res = sanitizeLogoSizeConfig({
    schoolLogoWidth: 500,
    schoolLogoHeight: 10,
    schoolLogoOffsetX: -200,
    osisLogoWidth: 68,
    osisLogoHeight: 88,
  });
  assert.equal(res.schoolLogoWidth, 220);
  assert.equal(res.schoolLogoHeight, 20);
  assert.equal(res.schoolLogoOffsetX, -120);
  assert.equal(res.osisLogoWidth, 68);
  assert.equal(res.osisLogoHeight, 88);
});

test('areLogoConfigsEqual detects unsaved logo size changes', () => {
  const base = sanitizeLogoSizeConfig(DEFAULT_KOP_LOGO_CONFIG);
  const same = sanitizeLogoSizeConfig({ ...DEFAULT_KOP_LOGO_CONFIG });
  const modified = sanitizeLogoSizeConfig({ ...DEFAULT_KOP_LOGO_CONFIG, schoolLogoWidth: 64 });
  assert.equal(areLogoConfigsEqual(base, same), true);
  assert.equal(areLogoConfigsEqual(base, modified), false);
});

test('sanitizeStampConfig validates stamp text, size, rotation, and color theme', () => {
  const stamp = sanitizeStampConfig(
    {
      headerText: '★ KEMENTERIAN AGAMA ★',
      institutionText: 'MTsN 1 Teladan',
      footerText: 'KEPALA MADRASAH',
      sizePx: 180,
      rotationDeg: -15,
      colorTheme: 'emerald',
    },
    'SMPN 1 Teladan'
  );
  assert.equal(stamp.headerText, '★ KEMENTERIAN AGAMA ★');
  assert.equal(stamp.institutionText, 'MTsN 1 Teladan');
  assert.equal(stamp.footerText, 'KEPALA MADRASAH');
  assert.equal(stamp.sizePx, 150);
  assert.equal(stamp.rotationDeg, -15);
  assert.equal(stamp.colorTheme, 'emerald');
});
