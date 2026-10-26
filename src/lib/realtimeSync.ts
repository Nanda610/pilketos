/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Pure functions for Real-Time State Synchronization & Unified Application Time
 * across Admin and Client instances.
 */

import { ElectionPeriod, ElectionStateSnapshot } from '../types';

/**
 * Calculates the clock offset between the authoritative server clock and the local client clock.
 * Supports optional round-trip time (RTT) compensation when clientSentAtMs is provided.
 */
export function calculateServerClockOffset(
  serverTimeMs: number,
  clientReceivedAtMs: number,
  clientSentAtMs?: number
): number {
  if (
    typeof clientSentAtMs === 'number' &&
    Number.isFinite(clientSentAtMs) &&
    clientReceivedAtMs >= clientSentAtMs
  ) {
    const midpointMs = clientSentAtMs + (clientReceivedAtMs - clientSentAtMs) / 2;
    return Math.round(serverTimeMs - midpointMs);
  }
  return Math.round(serverTimeMs - clientReceivedAtMs);
}

/**
 * Computes the unified Application Time (in ms) that is identical across all clients and admin.
 */
export function computeAppTimeMs(
  clientNowMs: number,
  serverClockOffsetMs: number,
  appTimeOffsetMs: number
): number {
  return Math.round(clientNowMs + serverClockOffsetMs + appTimeOffsetMs);
}

/**
 * Computes the required appTimeOffsetMs when the Admin sets a specific target application date/time.
 */
export function computeOffsetForTargetAppTime(
  targetAppTimeMs: number,
  authoritativeServerNowMs: number
): number {
  return Math.round(targetAppTimeMs - authoritativeServerNowMs);
}

/**
 * Determines whether an incoming remote state snapshot should overwrite local state.
 * Prevents stale echoes and infinite sync loops while guaranteeing all newer Admin changes apply immediately.
 */
export function shouldApplyRemoteSnapshot(
  local: Pick<ElectionStateSnapshot, 'revision' | 'updatedAt'>,
  remote: Pick<ElectionStateSnapshot, 'revision' | 'updatedAt'>,
  forceSync: boolean = false
): boolean {
  if (forceSync) return true;
  if (remote.revision > local.revision) return true;
  if (remote.revision < local.revision) return false;

  const localTime = Date.parse(local.updatedAt) || 0;
  const remoteTime = Date.parse(remote.updatedAt) || 0;
  return remoteTime > localTime;
}

/**
 * Formats the synchronized Application Time in Indonesian format (WIB / local display).
 */
export function formatAppTimeDisplay(appTimeMs: number): {
  timeString: string;
  dateString: string;
  isoString: string;
} {
  const date = new Date(appTimeMs);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const timeString = `${hours}:${minutes}:${seconds}`;

  const dateString = date.toLocaleDateString('id-ID', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return {
    timeString,
    dateString,
    isoString: date.toISOString(),
  };
}

export type ScheduleWindowState = 'OPEN' | 'BEFORE_OPEN' | 'AFTER_CLOSE' | 'CLOSED_PERIOD';

export interface VotingScheduleEvaluation {
  state: ScheduleWindowState;
  label: string;
  currentHm: string;
  openHm: string;
  closeHm: string;
}

/**
 * Evaluates the current synchronized application time against the active period's voting schedule.
 */
export function evaluateVotingSchedule(
  period: Pick<ElectionPeriod, 'status' | 'votingOpenTime' | 'votingCloseTime'>,
  appTimeMs: number
): VotingScheduleEvaluation {
  const date = new Date(appTimeMs);
  const curH = date.getHours();
  const curM = date.getMinutes();
  const currentMinutes = curH * 60 + curM;
  const currentHm = `${String(curH).padStart(2, '0')}:${String(curM).padStart(2, '0')}`;

  const openHm = period.votingOpenTime || '07:30';
  const closeHm = period.votingCloseTime || '15:00';

  const [openH, openM] = openHm.split(':').map((n) => parseInt(n, 10) || 0);
  const [closeH, closeM] = closeHm.split(':').map((n) => parseInt(n, 10) || 0);
  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;

  if (period.status !== 'active') {
    return {
      state: 'CLOSED_PERIOD',
      label: period.status === 'completed' ? 'Periode Selesai' : 'Periode Draft',
      currentHm,
      openHm,
      closeHm,
    };
  }

  if (currentMinutes < openMinutes) {
    return {
      state: 'BEFORE_OPEN',
      label: `Menunggu Jam Buka (${openHm} WIB)`,
      currentHm,
      openHm,
      closeHm,
    };
  }

  if (currentMinutes > closeMinutes) {
    return {
      state: 'AFTER_CLOSE',
      label: `Melewati Jam Tutup (${closeHm} WIB) · Periode Aktif`,
      currentHm,
      openHm,
      closeHm,
    };
  }

  return {
    state: 'OPEN',
    label: `Jadwal Aktif (${openHm} - ${closeHm} WIB)`,
    currentHm,
    openHm,
    closeHm,
  };
}
