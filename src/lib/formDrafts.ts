/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Pure utility for automatically persisting and restoring unsaved form input states
 * in localStorage so users do not lose work on accidental page refreshes.
 */

export const FORM_DRAFT_PREFIX = 'epilketos_form_draft_v1:';
export const DEFAULT_DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export const DRAFT_KEYS = {
  ADMIN_SCHOOL_FORM: 'admin_school_form',
  ADMIN_NEW_PERIOD: 'admin_new_period',
  ADMIN_EDIT_PERIOD: 'admin_edit_period',
  ADMIN_NEW_COMMITTEE: 'admin_new_committee',
  ADMIN_VIDEO_URL: 'admin_video_url',
  ADMIN_CLOCK_INPUT: 'admin_clock_input',
  PANITIA_CANDIDATE_FORM: 'panitia_candidate_form',
  PANITIA_NEW_VOTER: 'panitia_new_voter',
  PANITIA_IMPORT_CSV: 'panitia_import_csv',
  PANITIA_VIDEO_URL: 'panitia_video_url',
} as const;

export interface FormDraftEnvelope<T> {
  version: 1;
  updatedAt: number;
  data: T;
  mediaCompacted?: boolean;
}

type StorageReaderWriter = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function getBrowserLocalStorage(): StorageReaderWriter | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function getDraftStorageKey(draftKey: string): string {
  return `${FORM_DRAFT_PREFIX}${draftKey}`;
}

/**
 * Strips oversized data: URLs (e.g., large uploaded videos or multi-MB photos)
 * so text inputs still persist cleanly if localStorage hits its ~5MB quota.
 */
export function compactOversizedDraftPayload<T>(
  value: T,
  maxDataUrlLength = 120_000
): { compacted: T; didCompact: boolean } {
  let didCompact = false;

  const walk = (node: unknown): unknown => {
    if (typeof node === 'string') {
      if (node.startsWith('data:') && node.length > maxDataUrlLength) {
        didCompact = true;
        return '';
      }
      return node;
    }
    if (Array.isArray(node)) {
      return node.map(walk);
    }
    if (node && typeof node === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(node)) {
        out[k] = walk(v);
      }
      return out;
    }
    return node;
  };

  return {
    compacted: walk(value) as T,
    didCompact,
  };
}

export function saveFormDraft<T>(
  draftKey: string,
  data: T,
  storage?: StorageReaderWriter | null
): { saved: boolean; mediaCompacted: boolean } {
  const targetStorage = storage ?? getBrowserLocalStorage();
  if (!targetStorage) return { saved: false, mediaCompacted: false };

  const storageKey = getDraftStorageKey(draftKey);
  const fullEnvelope: FormDraftEnvelope<T> = {
    version: 1,
    updatedAt: Date.now(),
    data,
  };

  try {
    targetStorage.setItem(storageKey, JSON.stringify(fullEnvelope));
    return { saved: true, mediaCompacted: false };
  } catch {
    // Fallback: compact oversized embedded media data URLs so text fields never fail to save
    try {
      const { compacted, didCompact } = compactOversizedDraftPayload(data);
      const compactEnvelope: FormDraftEnvelope<T> = {
        version: 1,
        updatedAt: Date.now(),
        data: compacted,
        mediaCompacted: didCompact,
      };
      targetStorage.setItem(storageKey, JSON.stringify(compactEnvelope));
      return { saved: true, mediaCompacted: didCompact };
    } catch {
      return { saved: false, mediaCompacted: false };
    }
  }
}

export function loadFormDraft<T>(
  draftKey: string,
  maxAgeMs = DEFAULT_DRAFT_MAX_AGE_MS,
  storage?: StorageReaderWriter | null,
  nowMs = Date.now()
): FormDraftEnvelope<T> | null {
  const targetStorage = storage ?? getBrowserLocalStorage();
  if (!targetStorage) return null;

  const storageKey = getDraftStorageKey(draftKey);
  try {
    const raw = targetStorage.getItem(storageKey);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<FormDraftEnvelope<T>> | null;
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      parsed.version !== 1 ||
      typeof parsed.updatedAt !== 'number' ||
      !('data' in parsed)
    ) {
      targetStorage.removeItem(storageKey);
      return null;
    }

    if (maxAgeMs > 0 && nowMs - parsed.updatedAt > maxAgeMs) {
      targetStorage.removeItem(storageKey);
      return null;
    }

    return {
      version: 1,
      updatedAt: parsed.updatedAt,
      data: parsed.data as T,
      mediaCompacted: Boolean(parsed.mediaCompacted),
    };
  } catch {
    try {
      targetStorage.removeItem(storageKey);
    } catch {}
    return null;
  }
}

export function clearFormDraft(
  draftKey: string,
  storage?: StorageReaderWriter | null
): void {
  const targetStorage = storage ?? getBrowserLocalStorage();
  if (!targetStorage) return;

  try {
    targetStorage.removeItem(getDraftStorageKey(draftKey));
  } catch {}
}

export function formatDraftTimestamp(updatedAt: number): string {
  try {
    return new Date(updatedAt).toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}
