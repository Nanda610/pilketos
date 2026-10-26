/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Unit tests for Real-Time Synchronization & Unified Application Clock logic
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateServerClockOffset,
  computeAppTimeMs,
  computeOffsetForTargetAppTime,
  shouldApplyRemoteSnapshot,
  formatAppTimeDisplay,
  evaluateVotingSchedule,
} from './realtimeSync';

test('calculateServerClockOffset computes exact offset with and without RTT compensation', () => {
  // Direct offset without RTT
  const offset1 = calculateServerClockOffset(1700000005000, 1700000000000);
  assert.equal(offset1, 5000);

  // With RTT midpoint (sent at 1000, received at 1200 -> midpoint 1100, server was 2100 -> offset +1000)
  const offset2 = calculateServerClockOffset(2100, 1200, 1000);
  assert.equal(offset2, 1000);
});

test('computeAppTimeMs and computeOffsetForTargetAppTime synchronize Admin and Client clocks', () => {
  const serverNow = 1700000000000;
  // Client A has local clock 3000ms behind server
  const clientANow = serverNow - 3000;
  const clientAServerOffset = calculateServerClockOffset(serverNow, clientANow);

  // Client B has local clock 4500ms ahead of server
  const clientBNow = serverNow + 4500;
  const clientBServerOffset = calculateServerClockOffset(serverNow, clientBNow);

  // Admin sets target application time 1 hour ahead (+3600000ms)
  const targetAppTime = serverNow + 3600000;
  const appTimeOffsetMs = computeOffsetForTargetAppTime(targetAppTime, serverNow);
  assert.equal(appTimeOffsetMs, 3600000);

  // Both Client A and Client B must compute the exact same application time!
  const appTimeOnClientA = computeAppTimeMs(clientANow, clientAServerOffset, appTimeOffsetMs);
  const appTimeOnClientB = computeAppTimeMs(clientBNow, clientBServerOffset, appTimeOffsetMs);

  assert.equal(appTimeOnClientA, targetAppTime);
  assert.equal(appTimeOnClientB, targetAppTime);
  assert.equal(appTimeOnClientA, appTimeOnClientB);
});

test('shouldApplyRemoteSnapshot reconciles revisions and prevents stale overwrites', () => {
  const local = { revision: 5, updatedAt: '2026-10-25T10:00:00.000Z' };

  // Higher revision always wins
  assert.equal(
    shouldApplyRemoteSnapshot(local, { revision: 6, updatedAt: '2026-10-25T09:59:00.000Z' }),
    true
  );

  // Lower revision is rejected unless forceSync is true
  assert.equal(
    shouldApplyRemoteSnapshot(local, { revision: 4, updatedAt: '2026-10-25T10:05:00.000Z' }),
    false
  );
  assert.equal(
    shouldApplyRemoteSnapshot(local, { revision: 4, updatedAt: '2026-10-25T10:05:00.000Z' }, true),
    true
  );

  // Same revision compares updatedAt timestamp
  assert.equal(
    shouldApplyRemoteSnapshot(local, { revision: 5, updatedAt: '2026-10-25T10:00:01.000Z' }),
    true
  );
  assert.equal(
    shouldApplyRemoteSnapshot(local, { revision: 5, updatedAt: '2026-10-25T10:00:00.000Z' }),
    false
  );
});

test('evaluateVotingSchedule and formatAppTimeDisplay reflect synchronized application time', () => {
  const sampleDate = new Date(2026, 8, 15, 9, 30, 45).getTime(); // 09:30:45 local time
  const formatted = formatAppTimeDisplay(sampleDate);
  assert.equal(formatted.timeString, '09:30:45');

  const scheduleOpen = evaluateVotingSchedule(
    { status: 'active', votingOpenTime: '07:30', votingCloseTime: '15:00' },
    sampleDate
  );
  assert.equal(scheduleOpen.state, 'OPEN');

  const earlyMorning = new Date(2026, 8, 15, 6, 15, 0).getTime();
  const scheduleBefore = evaluateVotingSchedule(
    { status: 'active', votingOpenTime: '07:30', votingCloseTime: '15:00' },
    earlyMorning
  );
  assert.equal(scheduleBefore.state, 'BEFORE_OPEN');
});
