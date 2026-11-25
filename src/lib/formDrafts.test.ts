import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DRAFT_KEYS,
  clearFormDraft,
  compactOversizedDraftPayload,
  getDraftStorageKey,
  loadFormDraft,
  saveFormDraft,
} from './formDrafts';

class MemoryStorage implements Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  private map = new Map<string, string>();
  constructor(private readonly maxBytes = Infinity) {}

  getItem(key: string): string | null {
    return this.map.has(key) ? this.map.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    if (value.length > this.maxBytes) {
      throw new Error('QuotaExceededError');
    }
    this.map.set(key, value);
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }
}

test('saveFormDraft and loadFormDraft round-trip candidate registration inputs cleanly', () => {
  const storage = new MemoryStorage();
  const payload = {
    isOpen: true,
    editingCandidateId: null,
    form: {
      electionPeriodId: 'period_2026_2027',
      ballotNumber: 4,
      chairmanName: 'Siti Rahmawati',
      viceChairmanName: 'Dimas Pratama',
      chairmanClass: 'VIII A',
      viceChairmanClass: 'VII B',
      photoUrl: '',
      chairmanPhotoUrl: '',
      viceChairmanPhotoUrl: '',
      motto: 'Maju Bersama OSIS Hebat',
      vision: 'Mewujudkan sekolah berprestasi',
      mission: ['Misi 1', 'Misi 2'],
      programs: ['Program A'],
      videoUrl: '',
    },
  };

  const res = saveFormDraft(DRAFT_KEYS.PANITIA_CANDIDATE_FORM, payload, storage);
  assert.equal(res.saved, true);
  assert.equal(res.mediaCompacted, false);

  const loaded = loadFormDraft<typeof payload>(DRAFT_KEYS.PANITIA_CANDIDATE_FORM, undefined, storage);
  assert.ok(loaded);
  assert.equal(loaded.data.isOpen, true);
  assert.equal(loaded.data.form.chairmanName, 'Siti Rahmawati');
  assert.deepEqual(loaded.data.form.mission, ['Misi 1', 'Misi 2']);

  clearFormDraft(DRAFT_KEYS.PANITIA_CANDIDATE_FORM, storage);
  assert.equal(loadFormDraft(DRAFT_KEYS.PANITIA_CANDIDATE_FORM, undefined, storage), null);
});

test('saveFormDraft compacts oversized media data URLs on quota error while preserving text fields', () => {
  const storage = new MemoryStorage(5000);
  const bigVideoDataUrl = 'data:video/mp4;base64,' + 'A'.repeat(200_000);
  const smallAvatarDataUrl = 'data:image/png;base64,tiny';

  const payload = {
    isOpen: true,
    form: {
      chairmanName: 'Andi Wijaya',
      motto: 'Disiplin & Kreatif',
      videoUrl: bigVideoDataUrl,
      chairmanPhotoUrl: smallAvatarDataUrl,
    },
  };

  const res = saveFormDraft(DRAFT_KEYS.PANITIA_CANDIDATE_FORM, payload, storage);
  assert.equal(res.saved, true);
  assert.equal(res.mediaCompacted, true);

  const loaded = loadFormDraft<typeof payload>(DRAFT_KEYS.PANITIA_CANDIDATE_FORM, undefined, storage);
  assert.ok(loaded);
  assert.equal(loaded.mediaCompacted, true);
  assert.equal(loaded.data.form.chairmanName, 'Andi Wijaya');
  assert.equal(loaded.data.form.motto, 'Disiplin & Kreatif');
  assert.equal(loaded.data.form.videoUrl, '');
  assert.equal(loaded.data.form.chairmanPhotoUrl, smallAvatarDataUrl);
});

test('loadFormDraft rejects corrupted JSON or expired drafts and cleans storage', () => {
  const storage = new MemoryStorage();
  const key = getDraftStorageKey(DRAFT_KEYS.ADMIN_SCHOOL_FORM);
  storage.setItem(key, '{bad-json');
  assert.equal(loadFormDraft(DRAFT_KEYS.ADMIN_SCHOOL_FORM, undefined, storage), null);
  assert.equal(storage.getItem(key), null);

  saveFormDraft(DRAFT_KEYS.ADMIN_SCHOOL_FORM, { name: 'SMPN 1' }, storage);
  const expired = loadFormDraft(
    DRAFT_KEYS.ADMIN_SCHOOL_FORM,
    1000,
    storage,
    Date.now() + 5000
  );
  assert.equal(expired, null);
  assert.equal(storage.getItem(key), null);
});

test('compactOversizedDraftPayload handles nested arrays and objects safely', () => {
  const { compacted, didCompact } = compactOversizedDraftPayload(
    {
      title: 'Test',
      items: ['hello', 'data:image/png;base64,' + 'x'.repeat(200)],
    },
    100
  );
  assert.equal(didCompact, true);
  assert.equal(compacted.title, 'Test');
  assert.deepEqual(compacted.items, ['hello', '']);
});
