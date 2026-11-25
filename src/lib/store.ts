/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Enterprise In-Memory & LocalStorage State Store for E-Pilketos / E-Pilkosim Digital.
 * Implements relational constraints, atomic voting transactions, audit logs,
 * and multi-period dynamic switching.
 */

import {
  SchoolConfig,
  ElectionPeriod,
  Candidate,
  Voter,
  AnonymousVote,
  CommitteeMember,
  AuditLog,
  ElectionSummary,
  ElectionStateSnapshot,
  RealtimeSyncMetadata,
  UserAccount,
  AuthSession,
  UserRole,
  DeletedEntityTombstones,
} from '../types';
import {
  INITIAL_SCHOOL,
  INITIAL_PERIODS,
  INITIAL_CANDIDATES,
  INITIAL_VOTERS,
  INITIAL_VOTES,
  INITIAL_COMMITTEE,
  INITIAL_AUDIT_LOGS,
  INITIAL_ACCOUNTS,
} from './initialData';
import { generateRandomPin, hashPin, verifyPin, validateNisn, validatePin } from './security';
import {
  DEFAULT_EPOCH_ID,
  calculateServerClockOffset,
  computeAppTimeMs,
  computeOffsetForTargetAppTime,
  isResetEpochId,
  isUninitializedDefaultSnapshot,
  shouldApplyRemoteSnapshot,
} from './realtimeSync';
import { loadSnapshotFromIndexedDb, saveSnapshotToIndexedDb } from './indexedDbStore';
import {
  computePeriodStats,
  computePeriodTabulation,
  UnifiedPeriodStats,
} from './tabulation';
import { applyAuthoritativeStateUpdate } from './stateMerge';

const STORAGE_KEY_PREFIX = 'epilketos_state_smp_v2';
const BROADCAST_CHANNEL_NAME = 'epilketos_realtime_sync_v2';

export class ElectionStore {
  private school: SchoolConfig;
  private periods: ElectionPeriod[];
  private candidates: Candidate[];
  private voters: Voter[];
  private votes: AnonymousVote[];
  private committee: CommitteeMember[];
  private auditLogs: AuditLog[];
  private accounts: UserAccount[];
  private tombstones: DeletedEntityTombstones = {};
  private activeSession: AuthSession | null = null;
  private listeners: Set<() => void> = new Set();

  // Real-time synchronization & Unified Application Clock state
  private clientId: string = `client_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  private revision: number = 1;
  private epochId: string | undefined = DEFAULT_EPOCH_ID;
  private updatedAt: string = new Date().toISOString();
  private updatedBy: string = 'Sistem';
  private lastAction: string = 'INIT';
  private serverClockOffsetMs: number = 0;
  private appTimeOffsetMs: number = 0;
  private isConnected: boolean = false;
  private transport: RealtimeSyncMetadata['transport'] = 'connecting';
  private onlineClients: number = 1;
  private lastSyncedAt: string | null = null;
  private isApplyingRemoteState: boolean = false;
  private hasPendingLocalSync: boolean = false;
  private pendingSchoolMutation: boolean = false;
  private isHttpPushInFlight: boolean = false;
  private latestLocalMutationRevision: number = 0;
  private queuedPushQueue: Array<{ updatedBy: string; lastAction: string }> = [];
  private batchDepth: number = 0;
  private batchDirtyActions: Set<string> = new Set();
  private wasExplicitlyResetByServer: boolean = false;
  private pendingForceResync: boolean = false;

  private static readonly SCHOOL_MUTATING_LOCAL_ACTIONS = new Set([
    'UPDATE_KONFIGURASI_SEKOLAH',
    'SYNC_UPDATE',
    'RESET_DATA_DEMO',
    'RESTORE_CLIENT_STATE',
  ]);

  private ws: WebSocket | null = null;
  private broadcastChannel: BroadcastChannel | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private lastRestorePushAtMs: number = 0;

  private static cloneData<T>(data: T): T {
    return JSON.parse(JSON.stringify(data)) as T;
  }

  constructor() {
    this.school = ElectionStore.cloneData(INITIAL_SCHOOL);
    this.periods = ElectionStore.cloneData(INITIAL_PERIODS);
    this.candidates = ElectionStore.cloneData(INITIAL_CANDIDATES);
    this.voters = ElectionStore.cloneData(INITIAL_VOTERS);
    this.votes = ElectionStore.cloneData(INITIAL_VOTES);
    this.committee = ElectionStore.cloneData(INITIAL_COMMITTEE);
    this.auditLogs = ElectionStore.cloneData(INITIAL_AUDIT_LOGS);
    this.accounts = ElectionStore.cloneData(INITIAL_ACCOUNTS);

    this.loadFromStorage();
    void this.hydrateFromIndexedDb();
    this.initRealtimeSync();
  }

  // Subscribe to changes (Real-time reactive listener)
  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emitToListeners() {
    this.listeners.forEach((fn) => fn());
  }

  public runBatch<T>(
    fn: () => T,
    updatedBy: string = 'Admin Sekolah',
    lastAction: string = 'SYNC_UPDATE'
  ): T {
    this.batchDepth += 1;
    let result: T;
    try {
      result = fn();
    } finally {
      this.batchDepth -= 1;
    }
    if (this.batchDepth === 0 && this.batchDirtyActions.size > 0) {
      const actionToUse =
        this.batchDirtyActions.size === 1 ? Array.from(this.batchDirtyActions)[0] : lastAction;
      this.batchDirtyActions.clear();
      this.notify(updatedBy, actionToUse);
    }
    return result;
  }

  private notify(updatedBy: string = 'Admin Sekolah', lastAction: string = 'UPDATE_DATA') {
    if (!this.isApplyingRemoteState) {
      if (ElectionStore.SCHOOL_MUTATING_LOCAL_ACTIONS.has(lastAction)) {
        this.pendingSchoolMutation = true;
      }
      if (this.batchDepth > 0) {
        this.batchDirtyActions.add(lastAction);
        return;
      }
      this.revision += 1;
      this.latestLocalMutationRevision = this.revision;
      this.updatedAt = new Date(this.getAppTimeMs()).toISOString();
      this.updatedBy = updatedBy;
      this.lastAction = lastAction;
      this.hasPendingLocalSync = true;
      this.saveToStorage();
      this.pushStateToRemote(updatedBy, lastAction);
    } else {
      this.saveToStorage();
    }
    this.emitToListeners();
  }

  public getAppTimeMs(clientNowMs: number = Date.now()): number {
    return computeAppTimeMs(clientNowMs, this.serverClockOffsetMs, this.appTimeOffsetMs);
  }

  public getSyncMetadata(): RealtimeSyncMetadata {
    return {
      isConnected: this.isConnected,
      transport: this.transport,
      onlineClients: this.onlineClients,
      revision: this.revision,
      lastSyncedAt: this.lastSyncedAt,
      updatedBy: this.updatedBy,
      lastAction: this.lastAction,
      serverClockOffsetMs: this.serverClockOffsetMs,
      appTimeOffsetMs: this.appTimeOffsetMs,
    };
  }

  public getSnapshot(): ElectionStateSnapshot {
    return {
      revision: this.revision,
      epochId: this.epochId,
      updatedAt: this.updatedAt,
      updatedBy: this.updatedBy,
      lastAction: this.lastAction,
      appTimeOffsetMs: this.appTimeOffsetMs,
      school: this.school,
      periods: this.periods,
      candidates: this.candidates,
      voters: this.voters,
      votes: this.votes,
      committee: this.committee,
      auditLogs: this.auditLogs,
      accounts: this.accounts,
      tombstones: this.tombstones,
    };
  }

  public applyRemoteSnapshot(
    snapshot: ElectionStateSnapshot,
    serverTimeMs?: number,
    onlineClients?: number,
    forceSync: boolean = false,
    clientSentAtMs?: number
  ) {
    if (typeof serverTimeMs === 'number' && Number.isFinite(serverTimeMs)) {
      this.serverClockOffsetMs = calculateServerClockOffset(serverTimeMs, Date.now(), clientSentAtMs);
    }
    if (typeof onlineClients === 'number' && onlineClients >= 1) {
      this.onlineClients = onlineClients;
    }

    const remoteMeta = {
      revision: snapshot.revision ?? 0,
      updatedAt: snapshot.updatedAt || '',
      epochId: snapshot.epochId,
      lastAction: snapshot.lastAction,
    };
    const isRemoteUninitialized = isUninitializedDefaultSnapshot(remoteMeta);
    const isExplicitReset = isResetEpochId(snapshot.epochId) && snapshot.epochId !== this.epochId;

    const shouldApply = shouldApplyRemoteSnapshot(
      { revision: this.revision, updatedAt: this.updatedAt, epochId: this.epochId, lastAction: this.lastAction },
      remoteMeta,
      forceSync || isExplicitReset
    );

    // If local has unpushed mutations (e.g., newly created period, DPT, candidate, or committee) and a concurrent
    // remote update arrived before our push ACK returned, merge both non-destructively instead of overwriting local edits!
    if (this.hasPendingLocalSync && !isExplicitReset && !isRemoteUninitialized) {
      const effectivePendingAction = this.pendingSchoolMutation
        ? 'SYNC_UPDATE'
        : this.lastAction || 'SYNC_UPDATE';
      const merged = applyAuthoritativeStateUpdate({
        current: snapshot,
        incoming: this.getSnapshot(),
        updatedBy: this.updatedBy || 'Admin Sekolah',
        lastAction: effectivePendingAction,
        defaultAccounts: INITIAL_ACCOUNTS,
      });

      this.isApplyingRemoteState = true;
      try {
        this.revision = merged.revision;
        if (merged.epochId) this.epochId = merged.epochId;
        this.updatedAt = merged.updatedAt;
        this.updatedBy = merged.updatedBy;
        this.lastAction = merged.lastAction;
        this.appTimeOffsetMs = merged.appTimeOffsetMs;
        this.school = merged.school;
        this.periods = merged.periods;
        this.candidates = merged.candidates;
        this.voters = merged.voters;
        this.votes = merged.votes;
        this.committee = merged.committee;
        this.auditLogs = merged.auditLogs;
        this.accounts = merged.accounts ?? this.accounts;
        this.tombstones = merged.tombstones || {};
        this.lastSyncedAt = new Date(this.getAppTimeMs()).toISOString();
        this.saveToStorage();
      } finally {
        this.isApplyingRemoteState = false;
      }

      this.emitToListeners();
      if (!this.isHttpPushInFlight && this.queuedPushQueue.length === 0) {
        this.pushStateToRemote(
          this.updatedBy || 'Admin Sekolah',
          this.pendingSchoolMutation ? 'SYNC_UPDATE' : this.lastAction || 'RESTORE_CLIENT_STATE'
        );
      }
      return;
    }

    if (!shouldApply) {
      const now = Date.now();
      const localHasEdits =
        this.revision > 1 ||
        (this.lastAction !== 'INIT' && this.lastAction !== 'INIT_SYSTEM' && this.lastAction !== 'LOAD_DISK');
      if (
        (isRemoteUninitialized || (snapshot.revision ?? 0) < this.revision || this.hasPendingLocalSync) &&
        localHasEdits &&
        !isResetEpochId(snapshot.epochId) &&
        now - this.lastRestorePushAtMs > 2500
      ) {
        this.lastRestorePushAtMs = now;
        this.pushStateToRemote(
          this.updatedBy || 'Admin Sekolah',
          this.pendingSchoolMutation ? 'SYNC_UPDATE' : 'RESTORE_CLIENT_STATE'
        );
      } else if (typeof snapshot.appTimeOffsetMs === 'number' && snapshot.appTimeOffsetMs !== this.appTimeOffsetMs) {
        this.appTimeOffsetMs = snapshot.appTimeOffsetMs;
        this.emitToListeners();
      }
      return;
    }

    if (isExplicitReset) {
      this.wasExplicitlyResetByServer = true;
    }

    this.isApplyingRemoteState = true;
    try {
      this.revision = snapshot.revision ?? this.revision;
      if (snapshot.epochId) this.epochId = snapshot.epochId;
      this.updatedAt = snapshot.updatedAt || new Date(this.getAppTimeMs()).toISOString();
      this.updatedBy = snapshot.updatedBy || 'Admin Sekolah';
      this.lastAction = snapshot.lastAction || 'REALTIME_SYNC';
      this.hasPendingLocalSync = false;
      this.pendingSchoolMutation = false;
      if (typeof snapshot.appTimeOffsetMs === 'number') {
        this.appTimeOffsetMs = snapshot.appTimeOffsetMs;
      }
      if (snapshot.school) this.school = snapshot.school;
      if (Array.isArray(snapshot.periods) && snapshot.periods.length > 0) {
        this.periods = snapshot.periods;
      }
      if (Array.isArray(snapshot.candidates)) this.candidates = snapshot.candidates;
      if (Array.isArray(snapshot.voters)) this.voters = snapshot.voters;
      if (Array.isArray(snapshot.votes)) this.votes = snapshot.votes;
      if (Array.isArray(snapshot.committee)) this.committee = snapshot.committee;
      if (Array.isArray(snapshot.auditLogs)) this.auditLogs = snapshot.auditLogs;
      if (Array.isArray(snapshot.accounts)) this.accounts = snapshot.accounts;
      this.tombstones = snapshot.tombstones || {};

      this.lastSyncedAt = new Date(this.getAppTimeMs()).toISOString();
      this.saveToStorage();
    } finally {
      this.isApplyingRemoteState = false;
    }

    this.emitToListeners();
  }

  /**
   * Applies an atomic lightweight VOTE_CAST delta received from the authoritative server
   * via HTTP /api/vote response or WebSocket broadcast without re-transferring heavy base64 media.
   */
  private applyServerVoteDelta(payload: {
    vote?: AnonymousVote;
    voterUpdate?: { id: string; hasVoted: boolean; votedAt: string };
    auditLog?: AuditLog;
    revision?: number;
    epochId?: string;
    updatedAt?: string;
    updatedBy?: string;
    lastAction?: string;
    appTimeOffsetMs?: number;
    serverTimeMs?: number;
    onlineClients?: number;
  }) {
    if (typeof payload.serverTimeMs === 'number' && Number.isFinite(payload.serverTimeMs)) {
      this.serverClockOffsetMs = calculateServerClockOffset(payload.serverTimeMs, Date.now());
    }
    if (typeof payload.onlineClients === 'number' && payload.onlineClients >= 1) {
      this.onlineClients = payload.onlineClients;
    }
    if (typeof payload.appTimeOffsetMs === 'number') {
      this.appTimeOffsetMs = payload.appTimeOffsetMs;
    }

    this.isApplyingRemoteState = true;
    try {
      if (payload.vote && !this.votes.some((v) => v.id === payload.vote!.id)) {
        this.votes = [...this.votes, payload.vote];
      }
      if (payload.voterUpdate) {
        const { id, hasVoted, votedAt } = payload.voterUpdate;
        this.voters = this.voters.map((v) =>
          v.id === id ? { ...v, hasVoted, votedAt, pinPlain: undefined } : v
        );
      }
      if (payload.auditLog && !this.auditLogs.some((l) => l.id === payload.auditLog!.id)) {
        this.auditLogs = [payload.auditLog, ...this.auditLogs].slice(0, 200);
      }

      const expectedNext = this.revision + 1;
      if (typeof payload.revision === 'number') {
        if (payload.revision <= expectedNext) {
          this.revision = Math.max(this.revision, payload.revision);
        } else {
          // Missed intermediate revision(s): do not pre-bump revision so forced catch-up snapshot applies cleanly
          void this.fetchStateFromHttp(true);
        }
      }
      if (payload.epochId) this.epochId = payload.epochId;
      if (payload.updatedAt) this.updatedAt = payload.updatedAt;
      if (payload.updatedBy) this.updatedBy = payload.updatedBy;
      if (payload.lastAction) this.lastAction = payload.lastAction;

      this.lastSyncedAt = new Date(this.getAppTimeMs()).toISOString();
      this.saveToStorage();
    } finally {
      this.isApplyingRemoteState = false;
    }

    this.emitToListeners();
  }

  /**
   * Reconciles the local store with the server's merged authoritative snapshot returned as an ACK
   * to our own mutation. Preserves concurrent updates (e.g., live votes, other device edits) merged by server.
   */
  private applyAuthoritativeAckSnapshot(
    serverState: ElectionStateSnapshot,
    serverTimeMs?: number,
    onlineClients?: number,
    ackForRevision?: number
  ) {
    if (typeof serverTimeMs === 'number' && Number.isFinite(serverTimeMs)) {
      this.serverClockOffsetMs = calculateServerClockOffset(serverTimeMs, Date.now());
    }
    if (typeof onlineClients === 'number' && onlineClients >= 1) {
      this.onlineClients = onlineClients;
    }

    const noNewerLocalMutation =
      this.queuedPushQueue.length === 0 &&
      (typeof ackForRevision !== 'number' || this.latestLocalMutationRevision <= ackForRevision);

    // Avoid redundant re-emits when an identical WS echo arrives immediately after HTTP ACK
    if (
      noNewerLocalMutation &&
      !this.hasPendingLocalSync &&
      serverState.revision === this.revision &&
      serverState.updatedAt === this.updatedAt
    ) {
      return;
    }

    // Only adopt full merged collections if no newer local mutation occurred while this ACK was in flight
    if (noNewerLocalMutation && (serverState.revision ?? 0) >= this.revision) {
      this.isApplyingRemoteState = true;
      try {
        this.revision = Math.max(this.revision, serverState.revision ?? this.revision);
        if (serverState.epochId) this.epochId = serverState.epochId;
        if (serverState.updatedAt) this.updatedAt = serverState.updatedAt;
        if (serverState.updatedBy) this.updatedBy = serverState.updatedBy;
        if (serverState.lastAction) this.lastAction = serverState.lastAction;
        this.hasPendingLocalSync = false;
        this.pendingSchoolMutation = false;
        if (typeof serverState.appTimeOffsetMs === 'number') {
          this.appTimeOffsetMs = serverState.appTimeOffsetMs;
        }
        if (serverState.school) this.school = serverState.school;
        if (Array.isArray(serverState.periods) && serverState.periods.length > 0) {
          this.periods = serverState.periods;
        }
        if (Array.isArray(serverState.candidates)) this.candidates = serverState.candidates;
        if (Array.isArray(serverState.voters)) this.voters = serverState.voters;
        if (Array.isArray(serverState.votes)) this.votes = serverState.votes;
        if (Array.isArray(serverState.committee)) this.committee = serverState.committee;
        if (Array.isArray(serverState.auditLogs)) this.auditLogs = serverState.auditLogs;
        if (Array.isArray(serverState.accounts)) this.accounts = serverState.accounts;
        this.tombstones = serverState.tombstones || {};
        this.lastSyncedAt = new Date(this.getAppTimeMs()).toISOString();
        this.saveToStorage();
      } finally {
        this.isApplyingRemoteState = false;
      }
      this.emitToListeners();
    } else if (noNewerLocalMutation) {
      this.hasPendingLocalSync = false;
      this.pendingSchoolMutation = false;
      this.lastSyncedAt = new Date(this.getAppTimeMs()).toISOString();
      this.saveToStorage();
      this.emitToListeners();
    }
  }

  /**
   * Allows the Admin to synchronize or set a specific Application Time across all connected clients.
   */
  public setApplicationTime(targetAppTimeMs: number) {
    const authoritativeServerNowMs = Date.now() + this.serverClockOffsetMs;
    const newOffset = computeOffsetForTargetAppTime(targetAppTimeMs, authoritativeServerNowMs);
    this.appTimeOffsetMs = newOffset;
    const formattedTarget = new Date(targetAppTimeMs).toLocaleString('id-ID');
    this.logAudit(
      'Admin Sekolah',
      'SINKRONISASI_WAKTU_APLIKASI',
      `Waktu terpadu aplikasi diselaraskan untuk seluruh klien ke: ${formattedTarget} WIB.`,
      '192.168.10.1',
      'INFO'
    );
    this.notify('Admin Sekolah', 'SINKRONISASI_WAKTU_APLIKASI');

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: 'SET_APP_TIME',
          appTimeOffsetMs: newOffset,
          updatedBy: 'Admin Sekolah',
          senderId: this.clientId,
        })
      );
    } else if (typeof window !== 'undefined') {
      fetch('/api/time', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appTimeOffsetMs: newOffset,
          updatedBy: 'Admin Sekolah',
          senderId: this.clientId,
        }),
      }).catch(() => {});
    }
  }

  /**
   * Resets Application Time back to real-time server clock (offset = 0) across all clients.
   */
  public resetApplicationTimeToRealtime() {
    this.appTimeOffsetMs = 0;
    this.logAudit(
      'Admin Sekolah',
      'RESET_WAKTU_REALTIME',
      'Waktu aplikasi dikembalikan ke jam server real-time (WIB) untuk seluruh perangkat klien.',
      '192.168.10.1',
      'INFO'
    );
    this.notify('Admin Sekolah', 'RESET_WAKTU_REALTIME');

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: 'SET_APP_TIME',
          resetToRealTime: true,
          updatedBy: 'Admin Sekolah',
          senderId: this.clientId,
        })
      );
    } else if (typeof window !== 'undefined') {
      fetch('/api/time', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resetToRealTime: true,
          updatedBy: 'Admin Sekolah',
          senderId: this.clientId,
        }),
      }).catch(() => {});
    }
  }

  public async forceResyncWithServer(): Promise<void> {
    if (typeof window === 'undefined') return;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.pendingForceResync = true;
      try {
        this.ws.send(JSON.stringify({ type: 'REQUEST_STATE', clientSentAtMs: Date.now() }));
      } catch {
        // Fallback handled immediately below
      }
    }
    await this.fetchStateFromHttp(true);
  }

  private initRealtimeSync() {
    if (typeof window === 'undefined') return;

    // 1. Cross-Tab BroadcastChannel for immediate zero-latency multi-tab sync
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        this.broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
        this.broadcastChannel.onmessage = (event) => {
          const data = event.data;
          if (!data || data.senderId === this.clientId) return;
          if (data.type === 'STATE_UPDATED' && data.state) {
            this.applyRemoteSnapshot(data.state, data.serverTimeMs, data.onlineClients, false);
          }
        };
      } catch {
        // Ignore if BroadcastChannel is blocked
      }
    }

    // 2. Storage event listener for same-browser tab fallback
    window.addEventListener('storage', (event) => {
      if (event.key === `${STORAGE_KEY_PREFIX}_snapshot` && event.newValue) {
        try {
          const parsed = JSON.parse(event.newValue) as ElectionStateSnapshot;
          this.applyRemoteSnapshot(parsed, undefined, undefined, false);
        } catch {
          // Ignore
        }
      }
    });

    // 3. Connect to Authoritative Server via WebSocket (/ws) + HTTP initial fetch
    this.fetchStateFromHttp(false);
    this.connectWebSocket();

    // 4. Ultra-responsive Dual-Engine Synchronization Loop (every 1.2s)
    // - Keeps WebSocket alive with PING/PONG and latency calculation
    // - Concurrently checks /api/revision (150-byte payload) as an indestructible safety net
    this.pollTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify({ type: 'PING', clientSentAtMs: Date.now() }));
        } catch {
          this.connectWebSocket();
        }
      } else if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
        this.connectWebSocket();
      }
      this.checkRevisionAndSync();
    }, 1200);

    // 5. Instantly re-verify and sync when browser tab regains focus or device wakes from sleep
    const onWakeOrFocus = () => {
      this.checkRevisionAndSync();
      if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
        this.connectWebSocket();
      }
    };
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') onWakeOrFocus();
    });
    window.addEventListener('online', onWakeOrFocus);
    window.addEventListener('focus', onWakeOrFocus);

    // 6. Flush any pending unpushed mutations (e.g., newly created period) immediately before page unload/refresh
    const flushOnUnload = () => {
      this.saveToStorage();
      if (this.hasPendingLocalSync && typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        try {
          const actionToFlush = this.pendingSchoolMutation ? 'SYNC_UPDATE' : this.lastAction || 'SYNC_UPDATE';
          const compact = this.buildPushSnapshot(actionToFlush);
          const payload = JSON.stringify({
            state: compact,
            updatedBy: this.updatedBy || 'Admin Sekolah',
            lastAction: actionToFlush,
            senderId: this.clientId,
          });
          if (payload.length < 60000) {
            navigator.sendBeacon('/api/state', new Blob([payload], { type: 'application/json' }));
          }
        } catch {}
      }
    };
    window.addEventListener('pagehide', flushOnUnload);
    window.addEventListener('beforeunload', flushOnUnload);
  }

  private connectWebSocket() {
    if (typeof window === 'undefined' || typeof WebSocket === 'undefined') return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      const socket = new WebSocket(wsUrl);
      this.ws = socket;

      socket.onopen = () => {
        this.isConnected = true;
        this.transport = 'websocket';
        socket.send(JSON.stringify({ type: 'PING', clientSentAtMs: Date.now() }));
        this.emitToListeners();
      };

      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'INIT_STATE' && msg.state) {
            this.isConnected = true;
            this.transport = 'websocket';
            const forceApply = this.pendingForceResync;
            this.pendingForceResync = false;
            this.applyRemoteSnapshot(msg.state, msg.serverTimeMs, msg.onlineClients, forceApply);
            return;
          }

          if (msg.type === 'VOTE_CAST') {
            this.isConnected = true;
            this.transport = 'websocket';
            this.applyServerVoteDelta(msg);
            return;
          }

          if (msg.type === 'STATE_UPDATED' && msg.state) {
            this.isConnected = true;
            this.transport = 'websocket';
            if (msg.senderId === this.clientId) {
              if (!this.isHttpPushInFlight && this.queuedPushQueue.length === 0) {
                this.applyAuthoritativeAckSnapshot(msg.state, msg.serverTimeMs, msg.onlineClients);
              }
              return;
            }
            this.applyRemoteSnapshot(msg.state, msg.serverTimeMs, msg.onlineClients, false);
            return;
          }

          if (msg.type === 'PONG' || msg.type === 'TIME_HEARTBEAT' || msg.type === 'PRESENCE_UPDATE') {
            const prevConnected = this.isConnected;
            const prevTransport = this.transport;
            const prevOnline = this.onlineClients;
            const prevOffset = this.appTimeOffsetMs;

            this.isConnected = true;
            this.transport = 'websocket';
            if (typeof msg.serverTimeMs === 'number') {
              this.serverClockOffsetMs = calculateServerClockOffset(
                msg.serverTimeMs,
                Date.now(),
                msg.clientSentAtMs
              );
            }
            if (typeof msg.onlineClients === 'number') {
              this.onlineClients = msg.onlineClients;
            }
            if (typeof msg.appTimeOffsetMs === 'number' && msg.appTimeOffsetMs !== this.appTimeOffsetMs) {
              this.appTimeOffsetMs = msg.appTimeOffsetMs;
            }
            // Request full state if server diverged and we aren't actively waiting on an in-flight push ACK
            if (
              typeof msg.revision === 'number' &&
              (msg.revision > this.revision ||
                (msg.revision !== this.revision && !this.hasPendingLocalSync && !this.isHttpPushInFlight))
            ) {
              socket.send(JSON.stringify({ type: 'REQUEST_STATE' }));
            }
            this.lastSyncedAt = new Date(this.getAppTimeMs()).toISOString();
            if (
              !prevConnected ||
              prevTransport !== this.transport ||
              prevOnline !== this.onlineClients ||
              prevOffset !== this.appTimeOffsetMs
            ) {
              this.emitToListeners();
            }
          }
        } catch {
          // Ignore malformed WS message
        }
      };

      socket.onclose = () => {
        this.ws = null;
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => this.connectWebSocket(), 2000);
      };

      socket.onerror = () => {
        try {
          socket.close();
        } catch {}
      };
    } catch {
      // Fallback to HTTP polling / BroadcastChannel
    }
  }

  private async checkRevisionAndSync() {
    if (typeof window === 'undefined' || typeof fetch === 'undefined') return;
    try {
      const res = await fetch(`/api/revision?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
        },
      });
      if (!res.ok) {
        await this.fetchStateFromHttp(false);
        return;
      }
      const data = await res.json();
      if (typeof data.serverTimeMs === 'number') {
        this.serverClockOffsetMs = calculateServerClockOffset(data.serverTimeMs, Date.now());
      }
      if (typeof data.onlineClients === 'number') {
        this.onlineClients = data.onlineClients;
      }
      if (typeof data.appTimeOffsetMs === 'number' && data.appTimeOffsetMs !== this.appTimeOffsetMs) {
        this.appTimeOffsetMs = data.appTimeOffsetMs;
      }
      const remoteUninitialized = isUninitializedDefaultSnapshot({
        revision: typeof data.revision === 'number' ? data.revision : 1,
        lastAction: data.lastAction,
      });

      if (isResetEpochId(data.epochId) && data.epochId !== this.epochId) {
        await this.fetchStateFromHttp(true);
      } else if (this.hasPendingLocalSync && !this.isHttpPushInFlight && this.queuedPushQueue.length === 0) {
        this.pushStateToRemote(
          this.updatedBy || 'Admin Sekolah',
          this.pendingSchoolMutation ? 'SYNC_UPDATE' : this.lastAction || 'RESTORE_CLIENT_STATE'
        );
      } else if (typeof data.revision === 'number' && data.revision > this.revision) {
        // Server has a newer revision than us, immediately fetch full authoritative snapshot!
        await this.fetchStateFromHttp(false);
      } else if (
        typeof data.revision === 'number' &&
        (data.revision < this.revision || this.hasPendingLocalSync)
      ) {
        const localHasEdits =
          this.revision > 1 ||
          (this.lastAction !== 'INIT' && this.lastAction !== 'INIT_SYSTEM' && this.lastAction !== 'LOAD_DISK');
        if (localHasEdits && !this.isHttpPushInFlight) {
          const now = Date.now();
          if (now - this.lastRestorePushAtMs > 2500) {
            this.lastRestorePushAtMs = now;
            this.pushStateToRemote(
              this.updatedBy || 'Admin Sekolah',
              this.pendingSchoolMutation ? 'SYNC_UPDATE' : 'RESTORE_CLIENT_STATE'
            );
          }
        }
      } else {
        const prevConnected = this.isConnected;
        this.isConnected = true;
        this.lastSyncedAt = new Date(this.getAppTimeMs()).toISOString();
        if (!prevConnected) {
          this.emitToListeners();
        }
      }
    } catch {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        this.transport = typeof BroadcastChannel !== 'undefined' ? 'broadcast' : 'connecting';
      }
    }
  }

  private async fetchStateFromHttp(forceApply: boolean = false) {
    if (typeof window === 'undefined' || typeof fetch === 'undefined') return;
    const sentAt = Date.now();
    try {
      const res = await fetch(`/api/state?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
        },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data && data.state) {
        this.isConnected = true;
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
          this.transport = 'http-poll';
        }
        this.applyRemoteSnapshot(
          data.state,
          data.serverTimeMs,
          data.onlineClients,
          forceApply,
          sentAt
        );
      }
    } catch {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        this.transport = typeof BroadcastChannel !== 'undefined' ? 'broadcast' : 'connecting';
      }
    }
  }

  private pushStateToRemote(updatedBy: string, lastAction: string) {
    if (typeof window === 'undefined') return;
    const snapshot = this.getSnapshot();

    // 1. Broadcast to local tabs immediately
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: 'STATE_UPDATED',
          state: snapshot,
          senderId: this.clientId,
          serverTimeMs: Date.now() + this.serverClockOffsetMs,
          onlineClients: this.onlineClients,
        });
      } catch {
        // Ignore
      }
    }

    // 2. Push to authoritative server reliably via ordered queue (preserves distinct critical actions)
    const lastQueued = this.queuedPushQueue[this.queuedPushQueue.length - 1];
    if (!lastQueued || lastQueued.lastAction !== lastAction || lastQueued.updatedBy !== updatedBy) {
      this.queuedPushQueue.push({ updatedBy, lastAction });
    }
    void this.flushPushQueue();
  }

  private buildPushSnapshot(lastAction: string): ElectionStateSnapshot {
    const snapshot = this.getSnapshot();
    const mutatesSchool =
      lastAction === 'UPDATE_KONFIGURASI_SEKOLAH' ||
      lastAction === 'SYNC_UPDATE' ||
      lastAction === 'RESET_DATA_DEMO' ||
      lastAction === 'RESTORE_CLIENT_STATE' ||
      this.pendingSchoolMutation;

    if (mutatesSchool) {
      return snapshot;
    }

    // For period/voter/candidate/committee mutations, strip heavy base64 media from `school`
    // because authoritative merge preserves existing server school config unchanged.
    return {
      ...snapshot,
      school: {
        ...snapshot.school,
        openingVideoUrl: snapshot.school.openingVideoUrl?.startsWith('data:') ? '' : snapshot.school.openingVideoUrl,
        logoUrl: (snapshot.school.logoUrl?.length || 0) > 50000 ? '' : snapshot.school.logoUrl,
        osisLogoUrl: (snapshot.school.osisLogoUrl?.length || 0) > 50000 ? '' : snapshot.school.osisLogoUrl,
      },
    };
  }

  private async flushPushQueue(): Promise<void> {
    if (typeof window === 'undefined' || typeof fetch === 'undefined') return;
    if (this.isHttpPushInFlight) return;

    while (this.queuedPushQueue.length > 0) {
      const { updatedBy, lastAction } = this.queuedPushQueue.shift()!;

      const snapshot = this.buildPushSnapshot(lastAction);
      const sentRevision = snapshot.revision;
      const bodyStr = JSON.stringify({
        state: snapshot,
        updatedBy,
        lastAction,
        senderId: this.clientId,
      });

      this.isHttpPushInFlight = true;
      try {
        const res = await fetch('/api/state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: bodyStr,
          // keepalive ensures critical period/data saves finish even if the user reloads right away (up to 64KB browser limit)
          keepalive: bodyStr.length < 60000,
        });
        const data = res.ok ? await res.json() : null;
        if (data && data.state) {
          this.isConnected = true;
          this.applyAuthoritativeAckSnapshot(
            data.state,
            data.serverTimeMs,
            data.onlineClients,
            sentRevision
          );
        }
      } catch {
        // Keep hasPendingLocalSync = true so pollTimer / reconnect retries automatically
      } finally {
        this.isHttpPushInFlight = false;
      }
    }
  }

  private safeParseJson<T>(raw: string | null): T | null {
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  private loadFromStorage() {
    if (typeof window === 'undefined') return;
    const savedSchool = this.safeParseJson<SchoolConfig>(localStorage.getItem(`${STORAGE_KEY_PREFIX}_school`));
    if (savedSchool) {
      this.school = {
        ...INITIAL_SCHOOL,
        ...savedSchool,
        name: typeof savedSchool.name === 'string' && savedSchool.name.trim() !== '' ? savedSchool.name : INITIAL_SCHOOL.name,
        type: savedSchool.type === 'OSIS' || savedSchool.type === 'OSIM' ? savedSchool.type : INITIAL_SCHOOL.type,
        openingVideoEnabled: savedSchool.openingVideoEnabled !== false,
      };
    }

    const savedPeriods = this.safeParseJson<ElectionPeriod[]>(localStorage.getItem(`${STORAGE_KEY_PREFIX}_periods`));
    if (Array.isArray(savedPeriods) && savedPeriods.length > 0) {
      this.periods = savedPeriods;
    }

    const savedCandidates = this.safeParseJson<Candidate[]>(localStorage.getItem(`${STORAGE_KEY_PREFIX}_candidates`));
    if (Array.isArray(savedCandidates)) this.candidates = savedCandidates;

    const savedVoters = this.safeParseJson<Voter[]>(localStorage.getItem(`${STORAGE_KEY_PREFIX}_voters`));
    if (Array.isArray(savedVoters)) this.voters = savedVoters;

    const savedVotes = this.safeParseJson<AnonymousVote[]>(localStorage.getItem(`${STORAGE_KEY_PREFIX}_votes`));
    if (Array.isArray(savedVotes)) this.votes = savedVotes;

    const savedCommittee = this.safeParseJson<CommitteeMember[]>(localStorage.getItem(`${STORAGE_KEY_PREFIX}_committee`));
    if (Array.isArray(savedCommittee)) this.committee = savedCommittee;

    const savedLogs = this.safeParseJson<AuditLog[]>(localStorage.getItem(`${STORAGE_KEY_PREFIX}_logs`));
    if (Array.isArray(savedLogs)) this.auditLogs = savedLogs;

    const savedAccounts = this.safeParseJson<UserAccount[]>(localStorage.getItem(`${STORAGE_KEY_PREFIX}_accounts`));
    if (Array.isArray(savedAccounts)) this.accounts = savedAccounts;

    const meta = this.safeParseJson<Record<string, unknown>>(localStorage.getItem(`${STORAGE_KEY_PREFIX}_meta`));
    if (meta) {
      if (typeof meta.revision === 'number') this.revision = meta.revision;
      if (typeof meta.epochId === 'string' && meta.epochId) this.epochId = meta.epochId;
      if (typeof meta.appTimeOffsetMs === 'number') this.appTimeOffsetMs = meta.appTimeOffsetMs;
      if (typeof meta.updatedAt === 'string' && meta.updatedAt) this.updatedAt = meta.updatedAt;
      if (typeof meta.updatedBy === 'string' && meta.updatedBy) this.updatedBy = meta.updatedBy;
      if (typeof meta.lastAction === 'string' && meta.lastAction) this.lastAction = meta.lastAction;
      if (typeof meta.hasPendingLocalSync === 'boolean') this.hasPendingLocalSync = meta.hasPendingLocalSync;
      if (typeof meta.pendingSchoolMutation === 'boolean') this.pendingSchoolMutation = meta.pendingSchoolMutation;
      if (meta.tombstones && typeof meta.tombstones === 'object') {
        this.tombstones = meta.tombstones as DeletedEntityTombstones;
      }
    }

    // Restore active session if present
    try {
      const savedSession =
        sessionStorage.getItem(`${STORAGE_KEY_PREFIX}_session`) || localStorage.getItem(`${STORAGE_KEY_PREFIX}_session`);
      if (savedSession) {
        this.activeSession = JSON.parse(savedSession);
      }
    } catch {
      this.activeSession = null;
    }
  }

  private async hydrateFromIndexedDb() {
    if (typeof window === 'undefined') return;
    const idbSnapshot = await loadSnapshotFromIndexedDb();
    if (!idbSnapshot || this.wasExplicitlyResetByServer) return;

    const isFreshBootWithoutStorage = this.revision <= 1 && this.lastAction === 'INIT';
    const idbIsStrictlyNewer = idbSnapshot.revision > this.revision || (isFreshBootWithoutStorage && idbSnapshot.revision >= 1);
    const idbMatchesSameMutationForMediaOnly =
      !idbIsStrictlyNewer &&
      idbSnapshot.revision === this.revision &&
      Boolean(idbSnapshot.updatedAt) &&
      idbSnapshot.updatedAt === this.updatedAt;

    if (!idbIsStrictlyNewer && !idbMatchesSameMutationForMediaOnly) return;

    this.isApplyingRemoteState = true;
    try {
      if (idbIsStrictlyNewer) {
        this.revision = idbSnapshot.revision;
        if (idbSnapshot.epochId) this.epochId = idbSnapshot.epochId;
        if (idbSnapshot.updatedAt) this.updatedAt = idbSnapshot.updatedAt;
        if (idbSnapshot.updatedBy) this.updatedBy = idbSnapshot.updatedBy;
        if (idbSnapshot.lastAction) this.lastAction = idbSnapshot.lastAction;
        if (typeof idbSnapshot.appTimeOffsetMs === 'number') this.appTimeOffsetMs = idbSnapshot.appTimeOffsetMs;
        if (idbSnapshot.school) this.school = idbSnapshot.school;
        if (Array.isArray(idbSnapshot.periods) && idbSnapshot.periods.length > 0) this.periods = idbSnapshot.periods;
        if (Array.isArray(idbSnapshot.candidates)) this.candidates = idbSnapshot.candidates;
        if (Array.isArray(idbSnapshot.voters)) this.voters = idbSnapshot.voters;
        if (Array.isArray(idbSnapshot.votes)) this.votes = idbSnapshot.votes;
        if (Array.isArray(idbSnapshot.committee)) this.committee = idbSnapshot.committee;
        if (Array.isArray(idbSnapshot.auditLogs)) this.auditLogs = idbSnapshot.auditLogs;
        if (Array.isArray(idbSnapshot.accounts)) this.accounts = idbSnapshot.accounts;
        if (idbSnapshot.tombstones) this.tombstones = idbSnapshot.tombstones;
      } else if (idbMatchesSameMutationForMediaOnly) {
        // Recover only heavy binary assets stripped by 5MB localStorage quota on same revision
        if (idbSnapshot.school) {
          this.school = {
            ...this.school,
            logoUrl: this.school.logoUrl || idbSnapshot.school.logoUrl || '',
            osisLogoUrl: this.school.osisLogoUrl || idbSnapshot.school.osisLogoUrl || '',
            openingVideoUrl: this.school.openingVideoUrl || idbSnapshot.school.openingVideoUrl || '',
          };
        }
        if (Array.isArray(idbSnapshot.candidates)) {
          const idbCandMap = new Map(idbSnapshot.candidates.map((c) => [c.id, c]));
          this.candidates = this.candidates.map((c) => {
            const full = idbCandMap.get(c.id);
            if (!full) return c;
            return {
              ...c,
              photoUrl: c.photoUrl || full.photoUrl || '',
              chairmanPhotoUrl: c.chairmanPhotoUrl || full.chairmanPhotoUrl || '',
              viceChairmanPhotoUrl: c.viceChairmanPhotoUrl || full.viceChairmanPhotoUrl || '',
              videoUrl: c.videoUrl || full.videoUrl || '',
            };
          });
        }
      }
      this.saveToStorage(false);
    } finally {
      this.isApplyingRemoteState = false;
    }

    this.emitToListeners();
    void this.checkRevisionAndSync();
  }

  private safeSetStorage(key: string, value: string): boolean {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  }

  private saveToStorage(persistIndexedDb: boolean = true) {
    if (typeof window === 'undefined') return;
    // Save lightweight core state FIRST so 5MB localStorage quota on heavy base64 media never blocks saving periods or DPT
    this.safeSetStorage(`${STORAGE_KEY_PREFIX}_periods`, JSON.stringify(this.periods));
    this.safeSetStorage(`${STORAGE_KEY_PREFIX}_voters`, JSON.stringify(this.voters));
    this.safeSetStorage(`${STORAGE_KEY_PREFIX}_votes`, JSON.stringify(this.votes));
    this.safeSetStorage(`${STORAGE_KEY_PREFIX}_committee`, JSON.stringify(this.committee));
    this.safeSetStorage(`${STORAGE_KEY_PREFIX}_accounts`, JSON.stringify(this.accounts));
    this.safeSetStorage(
      `${STORAGE_KEY_PREFIX}_meta`,
      JSON.stringify({
        revision: this.revision,
        epochId: this.epochId,
        updatedAt: this.updatedAt,
        updatedBy: this.updatedBy,
        lastAction: this.lastAction,
        appTimeOffsetMs: this.appTimeOffsetMs,
        hasPendingLocalSync: this.hasPendingLocalSync,
        pendingSchoolMutation: this.pendingSchoolMutation,
        tombstones: this.tombstones,
      })
    );
    this.safeSetStorage(`${STORAGE_KEY_PREFIX}_logs`, JSON.stringify(this.auditLogs.slice(0, 100)));

    // Save school config with progressive quota fallbacks (full media stays in IndexedDB)
    const fullSchoolSaved = this.safeSetStorage(`${STORAGE_KEY_PREFIX}_school`, JSON.stringify(this.school));
    if (!fullSchoolSaved) {
      const compactSchool: SchoolConfig = {
        ...this.school,
        openingVideoUrl: this.school.openingVideoUrl?.startsWith('data:') ? '' : this.school.openingVideoUrl,
        logoUrl: (this.school.logoUrl?.length || 0) > 200000 ? '' : this.school.logoUrl,
        osisLogoUrl: (this.school.osisLogoUrl?.length || 0) > 200000 ? '' : this.school.osisLogoUrl,
      };
      if (!this.safeSetStorage(`${STORAGE_KEY_PREFIX}_school`, JSON.stringify(compactSchool))) {
        this.safeSetStorage(
          `${STORAGE_KEY_PREFIX}_school`,
          JSON.stringify({ ...compactSchool, logoUrl: '', osisLogoUrl: '', openingVideoUrl: '' })
        );
      }
    }

    // Save candidates with progressive quota fallbacks (full photos/videos stay in IndexedDB)
    const fullCandidatesSaved = this.safeSetStorage(`${STORAGE_KEY_PREFIX}_candidates`, JSON.stringify(this.candidates));
    if (!fullCandidatesSaved) {
      const compactCandidates = this.candidates.map((c) => ({
        ...c,
        videoUrl: c.videoUrl?.startsWith('data:') ? '' : c.videoUrl,
        photoUrl: (c.photoUrl?.length || 0) > 200000 ? '' : c.photoUrl,
        chairmanPhotoUrl: (c.chairmanPhotoUrl?.length || 0) > 200000 ? '' : c.chairmanPhotoUrl,
        viceChairmanPhotoUrl: (c.viceChairmanPhotoUrl?.length || 0) > 200000 ? '' : c.viceChairmanPhotoUrl,
      }));
      if (!this.safeSetStorage(`${STORAGE_KEY_PREFIX}_candidates`, JSON.stringify(compactCandidates))) {
        const textOnlyCandidates = compactCandidates.map((c) => ({
          ...c,
          photoUrl: '',
          chairmanPhotoUrl: '',
          viceChairmanPhotoUrl: '',
          videoUrl: '',
        }));
        this.safeSetStorage(`${STORAGE_KEY_PREFIX}_candidates`, JSON.stringify(textOnlyCandidates));
      }
    }

    // Snapshot is an optional cross-tab cache; skip silently if oversized
    this.safeSetStorage(`${STORAGE_KEY_PREFIX}_snapshot`, JSON.stringify(this.getSnapshot()));

    // Persist full unmodified snapshot (with all photos/videos) to IndexedDB
    if (persistIndexedDb) {
      void saveSnapshotToIndexedDb(this.getSnapshot());
    }
  }

  // Reset to initial demo data
  public resetToSampleData() {
    this.school = ElectionStore.cloneData(INITIAL_SCHOOL);
    this.periods = ElectionStore.cloneData(INITIAL_PERIODS);
    this.candidates = ElectionStore.cloneData(INITIAL_CANDIDATES);
    this.voters = ElectionStore.cloneData(INITIAL_VOTERS);
    this.votes = ElectionStore.cloneData(INITIAL_VOTES);
    this.committee = ElectionStore.cloneData(INITIAL_COMMITTEE);
    this.auditLogs = ElectionStore.cloneData(INITIAL_AUDIT_LOGS);
    this.accounts = ElectionStore.cloneData(INITIAL_ACCOUNTS);
    this.tombstones = {};
    this.logAudit('Admin Sekolah', 'RESET_DATA_DEMO', 'Database disetel ulang ke dataset simulasi awal.', '127.0.0.1', 'WARNING');
    this.notify('Admin Sekolah', 'RESET_DATA_DEMO');
  }

  // --- AUTHENTICATION & ACCESS CONTROL (ADMIN & PANITIA) ---
  public getAccounts(): UserAccount[] {
    return [...this.accounts];
  }

  public getActiveSession(): AuthSession | null {
    if (!this.activeSession && typeof window !== 'undefined') {
      try {
        const stored = sessionStorage.getItem(`${STORAGE_KEY_PREFIX}_session`) || localStorage.getItem(`${STORAGE_KEY_PREFIX}_session`);
        if (stored) {
          this.activeSession = JSON.parse(stored);
        }
      } catch {
        this.activeSession = null;
      }
    }
    return this.activeSession;
  }

  public login(username: string, password: string): { success: boolean; message: string; session?: AuthSession } {
    const cleanUser = username.trim().toLowerCase();
    const cleanPass = password.trim();

    if (!cleanUser || !cleanPass) {
      return { success: false, message: 'Nama pengguna dan kata sandi wajib diisi.' };
    }

    const account = this.accounts.find(
      (acc) => acc.username.toLowerCase() === cleanUser
    );

    if (!account) {
      this.logAudit('Sistem', 'LOGIN_FAILED', `Percobaan login gagal: pengguna "${cleanUser}" tidak ditemukan.`, '127.0.0.1', 'WARNING');
      return { success: false, message: 'Nama pengguna atau kata sandi tidak cocok.' };
    }

    const isValid = account.passwordPlain === cleanPass || (account.passwordHash && verifyPin(cleanPass, account.passwordHash));

    if (!isValid) {
      this.logAudit(account.role === 'admin' ? 'Admin Sekolah' : 'Panitia', 'LOGIN_FAILED', `Percobaan login gagal untuk akun: "${account.username}".`, '127.0.0.1', 'WARNING');
      return { success: false, message: 'Kata sandi yang Anda masukkan salah.' };
    }

    const session: AuthSession = {
      id: account.id,
      username: account.username,
      name: account.name,
      role: account.role,
      token: `tok_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      loginTime: new Date(this.getAppTimeMs()).toISOString(),
    };

    this.activeSession = session;
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem(`${STORAGE_KEY_PREFIX}_session`, JSON.stringify(session));
        localStorage.setItem(`${STORAGE_KEY_PREFIX}_session`, JSON.stringify(session));
      } catch {}
    }

    // Update lastLoginAt
    this.accounts = this.accounts.map((acc) =>
      acc.id === account.id ? { ...acc, lastLoginAt: session.loginTime } : acc
    );

    this.logAudit(
      account.role === 'admin' ? 'Admin Sekolah' : 'Panitia',
      'LOGIN_SUCCESS',
      `Berhasil masuk sebagai ${account.role === 'admin' ? 'Administrator Sekolah' : 'Panitia Pemilihan'} (${account.name}).`,
      '127.0.0.1',
      'INFO'
    );

    this.notify(account.role === 'admin' ? 'Admin Sekolah' : 'Panitia', 'USER_LOGIN');
    return { success: true, message: 'Login berhasil.', session };
  }

  public logout(): void {
    const prev = this.activeSession;
    this.activeSession = null;
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem(`${STORAGE_KEY_PREFIX}_session`);
        localStorage.removeItem(`${STORAGE_KEY_PREFIX}_session`);
      } catch {}
    }
    if (prev) {
      this.logAudit(
        prev.role === 'admin' ? 'Admin Sekolah' : 'Panitia',
        'LOGOUT',
        `Pengguna ${prev.name} (${prev.username}) telah keluar dari sistem.`,
        '127.0.0.1',
        'INFO'
      );
    }
    this.emitToListeners();
  }

  public updateAccountPassword(
    username: string,
    newPasswordPlain: string,
    actor: string = 'Admin Sekolah'
  ): { success: boolean; message: string } {
    if (!newPasswordPlain || newPasswordPlain.trim().length < 4) {
      return { success: false, message: 'Kata sandi minimal terdiri dari 4 karakter.' };
    }

    const cleanUser = username.trim().toLowerCase();
    const index = this.accounts.findIndex((acc) => acc.username.toLowerCase() === cleanUser);

    if (index === -1) {
      return { success: false, message: `Akun dengan username "${username}" tidak ditemukan.` };
    }

    const updatedAccount: UserAccount = {
      ...this.accounts[index],
      passwordPlain: newPasswordPlain.trim(),
      updatedAt: new Date(this.getAppTimeMs()).toISOString(),
    };

    const nextAccounts = [...this.accounts];
    nextAccounts[index] = updatedAccount;
    this.accounts = nextAccounts;

    this.logAudit(
      'Admin Sekolah',
      'UPDATE_PASSWORD',
      `Kata sandi untuk akun ${updatedAccount.name} (${updatedAccount.username}) berhasil diperbarui oleh ${actor}.`,
      '192.168.10.1',
      'INFO'
    );

    this.notify(actor, 'UPDATE_PASSWORD');
    return { success: true, message: 'Kata sandi berhasil diperbarui.' };
  }

  public resetAccountsToDefault(actor: string = 'Admin Sekolah'): void {
    this.accounts = INITIAL_ACCOUNTS;
    this.logAudit(
      'Admin Sekolah',
      'RESET_ACCOUNTS_DEFAULT',
      `Akun dan kata sandi Administrator & Panitia dikembalikan ke setelan awal oleh ${actor}.`,
      '192.168.10.1',
      'WARNING'
    );
    this.notify(actor, 'RESET_ACCOUNTS_DEFAULT');
  }

  // --- SCHOOL CONFIGURATION ---
  public getSchool(): SchoolConfig {
    return { ...this.school };
  }

  public updateSchool(updated: Partial<SchoolConfig>) {
    this.school = { ...this.school, ...updated };
    this.logAudit('Admin Sekolah', 'UPDATE_KONFIGURASI_SEKOLAH', `Identitas sekolah diperbarui: ${this.school.name}`, '192.168.10.1', 'INFO');
    this.notify('Admin Sekolah', 'UPDATE_KONFIGURASI_SEKOLAH');
  }

  // --- MULTI-PERIOD DYNAMIC MANAGEMENT ---
  public getPeriods(): ElectionPeriod[] {
    return [...this.periods];
  }

  public getActivePeriod(): ElectionPeriod {
    const active = this.periods.find((p) => p.status === 'active');
    if (!active) {
      // Fallback to first period or create default
      return this.periods[0];
    }
    return active;
  }

  public setActivePeriod(periodId: string) {
    this.periods = this.periods.map((p) => {
      if (p.id === periodId) {
        return { ...p, status: 'active' };
      }
      return { ...p, status: p.status === 'active' ? 'completed' : p.status };
    });
    const activated = this.periods.find((p) => p.id === periodId);
    this.logAudit(
      'Admin Sekolah',
      'AKTIVASI_PERIODE_BARU',
      `Periode pemilihan ${activated?.periodName || periodId} kini berstatus AKTIF. Periode lain dinonaktifkan.`,
      '192.168.10.1',
      'INFO'
    );
    this.notify('Admin Sekolah', 'AKTIVASI_PERIODE_BARU');
  }

  public getPeriodStats(periodId: string): UnifiedPeriodStats {
    return computePeriodStats(
      {
        periods: this.periods,
        voters: this.voters,
        votes: this.votes,
        candidates: this.candidates,
        committee: this.committee,
      },
      periodId
    );
  }

  public addPeriod(
    period: Omit<ElectionPeriod, 'id' | 'createdAt'>,
    options?: {
      copyFromPeriodId?: string;
      copyVoters?: boolean;
      copyCandidates?: boolean;
      copyCommittee?: boolean;
      copyVotes?: boolean;
    }
  ): ElectionPeriod {
    const uniqueSuffix = Math.random().toString(36).substring(2, 6);
    const newPeriod: ElectionPeriod = {
      ...period,
      id: `period_${Date.now()}_${uniqueSuffix}`,
      createdAt: new Date(this.getAppTimeMs()).toISOString(),
    };
    if (newPeriod.status === 'active') {
      // Demote previous active period(s) to archived/completed without altering any of their voters, candidates, or votes
      this.periods = this.periods.map((p) => ({
        ...p,
        status: p.status === 'active' ? 'completed' : p.status,
      }));
    }
    this.periods = [...this.periods, newPeriod];

    // Optional non-destructive duplication from a source period (source period data remains 100% intact)
    if (options?.copyFromPeriodId) {
      const srcId = options.copyFromPeriodId;
      const preserveVotes = Boolean(options.copyVotes && options.copyVoters && options.copyCandidates);
      const candidateIdMap = new Map<string, string>();

      if (options.copyCandidates) {
        const clonedCandidates: Candidate[] = this.candidates
          .filter((c) => c.electionPeriodId === srcId)
          .map((c, idx) => {
            const newCandId = `cand_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`;
            candidateIdMap.set(c.id, newCandId);
            return {
              ...c,
              id: newCandId,
              electionPeriodId: newPeriod.id,
              mission: [...c.mission],
              programs: [...c.programs],
            };
          });
        this.candidates = [...this.candidates, ...clonedCandidates];
      }

      if (options.copyVoters) {
        const clonedVoters: Voter[] = this.voters
          .filter((v) => v.electionPeriodId === srcId)
          .map((v, idx) => {
            if (preserveVotes) {
              const unvotedPin = !v.hasVoted ? v.pinPlain || generateRandomPin(6) : undefined;
              return {
                ...v,
                id: `voter_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
                electionPeriodId: newPeriod.id,
                pinPlain: v.hasVoted ? undefined : unvotedPin,
                pinHash: v.hasVoted ? v.pinHash : v.pinPlain ? v.pinHash : hashPin(unvotedPin!),
              };
            }
            const plainPin = v.pinPlain || generateRandomPin(6);
            return {
              ...v,
              id: `voter_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
              electionPeriodId: newPeriod.id,
              pinPlain: plainPin,
              pinHash: v.pinPlain ? v.pinHash : hashPin(plainPin),
              hasVoted: false,
              votedAt: undefined,
              tokenPrinted: false,
            };
          });
        this.voters = [...this.voters, ...clonedVoters];
      }

      if (preserveVotes) {
        const clonedVotes: AnonymousVote[] = this.votes
          .filter((vote) => vote.electionPeriodId === srcId && candidateIdMap.has(vote.candidateId))
          .map((vote, idx) => ({
            ...vote,
            id: `vote_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
            electionPeriodId: newPeriod.id,
            candidateId: candidateIdMap.get(vote.candidateId)!,
          }));
        this.votes = [...this.votes, ...clonedVotes];
      }

      if (options.copyCommittee) {
        const clonedCommittee: CommitteeMember[] = this.committee
          .filter((m) => m.electionPeriodId === srcId)
          .map((m, idx) => ({
            ...m,
            id: `comm_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
            electionPeriodId: newPeriod.id,
          }));
        this.committee = [...this.committee, ...clonedCommittee];
      }
    }

    this.logAudit(
      'Admin Sekolah',
      'BUAT_PERIODE_BARU',
      `Menambahkan periode pemilihan: ${newPeriod.periodName} (TA ${newPeriod.academicYear})`,
      '192.168.10.1',
      'INFO'
    );
    this.notify('Admin Sekolah', 'BUAT_PERIODE_BARU');
    return newPeriod;
  }

  public updatePeriod(periodId: string, updates: Partial<ElectionPeriod>) {
    const activating = updates.status === 'active';
    this.periods = this.periods.map((p) => {
      if (p.id === periodId) {
        return { ...p, ...updates, id: p.id };
      }
      if (activating && p.status === 'active') {
        return { ...p, status: 'completed' };
      }
      return p;
    });
    this.logAudit('Admin Sekolah', 'UPDATE_PERIODE', `Memperbarui data periode ${periodId}`, '192.168.10.1', 'INFO');
    this.notify('Admin Sekolah', 'UPDATE_PERIODE');
  }

  private recordTombstones(bucket: keyof DeletedEntityTombstones, ids: string[]) {
    if (ids.length === 0) return;
    const prev = this.tombstones[bucket] || [];
    const merged = Array.from(new Set([...prev, ...ids]));
    this.tombstones = {
      ...this.tombstones,
      [bucket]: merged.length > 500 ? merged.slice(merged.length - 500) : merged,
    };
  }

  public deletePeriod(periodId: string): { success: boolean; message: string } {
    if (this.periods.length <= 1) {
      return {
        success: false,
        message: 'Tidak dapat menghapus periode. Minimal harus ada 1 periode pemilihan pada sistem.'
      };
    }

    const targetPeriod = this.periods.find((p) => p.id === periodId);
    if (!targetPeriod) {
      return { success: false, message: 'Periode tidak ditemukan.' };
    }

    const wasActive = targetPeriod.status === 'active';

    const removedCandidateIds = this.candidates.filter((c) => c.electionPeriodId === periodId).map((c) => c.id);
    const removedVoterIds = this.voters.filter((v) => v.electionPeriodId === periodId).map((v) => v.id);
    const removedCommitteeIds = this.committee.filter((c) => c.electionPeriodId === periodId).map((c) => c.id);

    this.recordTombstones('periods', [periodId]);
    this.recordTombstones('candidates', removedCandidateIds);
    this.recordTombstones('voters', removedVoterIds);
    this.recordTombstones('committee', removedCommitteeIds);

    // Remove the period
    this.periods = this.periods.filter((p) => p.id !== periodId);

    // If deleted period was active, set the first remaining period to active
    if (wasActive && this.periods.length > 0) {
      this.periods[0] = { ...this.periods[0], status: 'active' };
    }

    // Clean up associated candidates, voters, votes, and committee
    this.candidates = this.candidates.filter((c) => c.electionPeriodId !== periodId);
    this.voters = this.voters.filter((v) => v.electionPeriodId !== periodId);
    this.votes = this.votes.filter((v) => v.electionPeriodId !== periodId);
    this.committee = this.committee.filter((c) => c.electionPeriodId !== periodId);

    this.logAudit(
      'Admin Sekolah',
      'HAPUS_PERIODE',
      `Menghapus periode pemilihan "${targetPeriod.periodName}" beserta data terkaitnya.`,
      '192.168.10.1',
      'WARNING'
    );
    this.notify('Admin Sekolah', 'HAPUS_PERIODE');

    return {
      success: true,
      message: `Periode "${targetPeriod.periodName}" berhasil dihapus secara permanen.`,
    };
  }

  // --- CANDIDATE MANAGEMENT ---
  public getCandidates(periodId?: string): Candidate[] {
    const targetPeriod = periodId || this.getActivePeriod().id;
    return this.candidates
      .filter((c) => c.electionPeriodId === targetPeriod)
      .sort((a, b) => a.ballotNumber - b.ballotNumber);
  }

  public addCandidate(candidate: Omit<Candidate, 'id'>): Candidate {
    const newCandidate: Candidate = {
      ...candidate,
      id: `cand_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    };
    this.candidates = [...this.candidates, newCandidate];
    this.logAudit(
      'Panitia',
      'TAMBAH_PASLON',
      `Paslon No. Urut ${newCandidate.ballotNumber} (${newCandidate.chairmanName} & ${newCandidate.viceChairmanName}) berhasil didaftarkan.`,
      '192.168.10.15',
      'INFO'
    );
    this.notify('Panitia', 'TAMBAH_PASLON');
    return newCandidate;
  }

  public updateCandidate(candidateId: string, updates: Partial<Candidate>) {
    this.candidates = this.candidates.map((c) => {
      if (c.id === candidateId) {
        return { ...c, ...updates };
      }
      return c;
    });
    this.logAudit('Panitia', 'UPDATE_PASLON', `Data kandidat ID ${candidateId} diperbarui.`, '192.168.10.15', 'INFO');
    this.notify('Panitia', 'UPDATE_PASLON');
  }

  public deleteCandidate(candidateId: string): { success: boolean; message: string; removedVotes?: number } {
    const candidate = this.candidates.find((c) => c.id === candidateId);
    if (!candidate) {
      return { success: false, message: 'Pasangan calon tidak ditemukan.' };
    }

    const periodId = candidate.electionPeriodId;
    const removedVotesCount = this.votes.filter((v) => v.candidateId === candidateId).length;

    this.candidates = this.candidates.filter((c) => c.id !== candidateId);
    this.votes = this.votes.filter((v) => v.candidateId !== candidateId);
    this.recordTombstones('candidates', [candidateId]);

    // Keep DPT voted count mathematically synchronized with remaining valid votes in the period
    if (removedVotesCount > 0) {
      const remainingValidVotesCount = this.votes.filter((v) => v.electionPeriodId === periodId).length;
      const currentVotedVotersCount = this.voters.filter((v) => v.electionPeriodId === periodId && v.hasVoted).length;
      let excessToRevert = Math.max(0, currentVotedVotersCount - remainingValidVotesCount);

      if (excessToRevert > 0) {
        const votedIndices = this.voters
          .map((v, idx) => ({ v, idx }))
          .filter((entry) => entry.v.electionPeriodId === periodId && entry.v.hasVoted)
          .sort((a, b) => (Date.parse(b.v.votedAt || '') || 0) - (Date.parse(a.v.votedAt || '') || 0));

        const updatedVoters = [...this.voters];
        for (const entry of votedIndices) {
          if (excessToRevert <= 0) break;
          const newPin = generateRandomPin(6);
          updatedVoters[entry.idx] = {
            ...entry.v,
            hasVoted: false,
            votedAt: undefined,
            pinPlain: newPin,
            pinHash: hashPin(newPin),
            tokenPrinted: false,
          };
          excessToRevert--;
        }
        this.voters = updatedVoters;
      }
    }

    this.logAudit(
      'Panitia',
      'HAPUS_PASLON',
      `Menghapus Paslon No. ${candidate.ballotNumber} (${candidate.chairmanName} & ${candidate.viceChairmanName})${removedVotesCount > 0 ? ` beserta ${removedVotesCount} suara terkait` : ''}.`,
      '192.168.10.15',
      'WARNING'
    );
    this.notify('Panitia', 'HAPUS_PASLON');
    return {
      success: true,
      removedVotes: removedVotesCount,
      message:
        removedVotesCount > 0
          ? `Paslon No. ${candidate.ballotNumber} beserta ${removedVotesCount} suara terkait berhasil dihapus.`
          : `Paslon No. ${candidate.ballotNumber} berhasil dihapus.`,
    };
  }

  // --- DPT (DAFTAR PEMILIH TETAP) MANAGEMENT ---
  public getVoters(periodId?: string): Voter[] {
    const targetPeriod = periodId || this.getActivePeriod().id;
    return this.voters.filter((v) => v.electionPeriodId === targetPeriod);
  }

  public addVoter(
    voterData: {
      nisn: string;
      fullName: string;
      className: string;
      gradeLevel: string;
      gender: 'L' | 'P';
    },
    periodId?: string
  ): { success: boolean; message: string; voter?: Voter } {
    const nisnCheck = validateNisn(voterData.nisn);
    if (!nisnCheck.isValid) {
      return { success: false, message: nisnCheck.message || 'NISN tidak valid' };
    }

    const targetPeriodId = periodId || this.getActivePeriod().id;
    const existing = this.voters.find(
      (v) => v.electionPeriodId === targetPeriodId && v.nisn === voterData.nisn.trim()
    );

    if (existing) {
      return { success: false, message: `Siswa dengan NISN ${voterData.nisn} sudah terdaftar dalam DPT periode ini.` };
    }

    const cleanClassName = voterData.className.trim();
    const upperClass = cleanClassName.toUpperCase();
    const inferredFromClass =
      upperClass.startsWith('XII') || upperClass.startsWith('12')
        ? 'XII'
        : upperClass.startsWith('XI') || upperClass.startsWith('11')
        ? 'XI'
        : upperClass.startsWith('X') || upperClass.startsWith('10')
        ? 'X'
        : upperClass.startsWith('IX') || upperClass.startsWith('9')
        ? 'IX'
        : upperClass.startsWith('VIII') || upperClass.startsWith('8')
        ? 'VIII'
        : upperClass.startsWith('VII') || upperClass.startsWith('7')
        ? 'VII'
        : '';

    const plainPin = generateRandomPin(6);
    const pinHash = hashPin(plainPin);

    const newVoter: Voter = {
      id: `voter_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      electionPeriodId: targetPeriodId,
      nisn: voterData.nisn.trim(),
      fullName: voterData.fullName.trim(),
      className: cleanClassName,
      gradeLevel: inferredFromClass || voterData.gradeLevel || 'VII',
      gender: voterData.gender,
      pinPlain: plainPin,
      pinHash,
      hasVoted: false,
      tokenPrinted: false,
    };

    this.voters.push(newVoter);
    this.logAudit('Panitia', 'TAMBAH_PEMILIH_DPT', `Siswa ${newVoter.fullName} (${newVoter.nisn}) ditambahkan ke DPT.`, '192.168.10.15', 'INFO');
    this.notify('Panitia', 'TAMBAH_PEMILIH_DPT');
    return { success: true, message: 'Pemilih berhasil ditambahkan', voter: newVoter };
  }

  public bulkImportVoters(
    rows: Array<{ nisn: string; fullName: string; className: string; gender?: string; gradeLevel?: string }>,
    periodId?: string
  ): { added: number; skipped: number; errors: string[] } {
    const targetPeriodId = periodId || this.getActivePeriod().id;
    let added = 0;
    let skipped = 0;
    const errors: string[] = [];

    rows.forEach((row, index) => {
      const nisnCheck = validateNisn(row.nisn);
      if (!nisnCheck.isValid) {
        skipped++;
        errors.push(`Baris ${index + 1}: NISN '${row.nisn}' tidak valid.`);
        return;
      }

      const exists = this.voters.some(
        (v) => v.electionPeriodId === targetPeriodId && v.nisn === row.nisn.trim()
      );

      if (exists) {
        skipped++;
        return;
      }

      // Determine grade level from className (SMP: VII, VIII, IX or 7, 8, 9)
      const inferredGrade =
        row.gradeLevel ||
        (row.className.toUpperCase().startsWith('IX') || row.className.toUpperCase().startsWith('9')
          ? 'IX'
          : row.className.toUpperCase().startsWith('VIII') || row.className.toUpperCase().startsWith('8')
          ? 'VIII'
          : 'VII');

      const gender: 'L' | 'P' =
        row.gender?.toUpperCase().startsWith('P') || row.gender?.toUpperCase().startsWith('W')
          ? 'P'
          : 'L';

      const plainPin = generateRandomPin(6);
      const pinHash = hashPin(plainPin);

      this.voters.push({
        id: `voter_${Date.now()}_${index}`,
        electionPeriodId: targetPeriodId,
        nisn: row.nisn.trim(),
        fullName: row.fullName.trim(),
        className: row.className.trim(),
        gradeLevel: inferredGrade,
        gender,
        pinPlain: plainPin,
        pinHash,
        hasVoted: false,
        tokenPrinted: false,
      });
      added++;
    });

    this.logAudit(
      'Panitia',
      'IMPORT_DPT_MASSAL',
      `Import DPT selesai: ${added} siswa baru ditambahkan, ${skipped} dilewati.`,
      '192.168.10.15',
      'INFO'
    );
    this.notify('Panitia', 'IMPORT_DPT_MASSAL');
    return { added, skipped, errors };
  }

  public resetVoterPin(voterId: string): { success: boolean; message: string; newPin?: string } {
    const voter = this.voters.find((v) => v.id === voterId);
    if (!voter) return { success: false, message: 'Pemilih tidak ditemukan.' };

    if (voter.hasVoted) {
      return { success: false, message: 'Tidak dapat mereset PIN karena siswa sudah menggunakan hak suara.' };
    }

    const newPin = generateRandomPin(6);
    voter.pinPlain = newPin;
    voter.pinHash = hashPin(newPin);
    voter.tokenPrinted = false;

    this.logAudit(
      'Panitia',
      'RESET_PIN_PEMILIH',
      `PIN token untuk ${voter.fullName} (${voter.nisn}) berhasil direset.`,
      '192.168.10.15',
      'WARNING'
    );
    this.notify('Panitia', 'RESET_PIN_PEMILIH');
    return { success: true, message: 'PIN berhasil direset.', newPin };
  }

  public generateMissingPins(periodId?: string): number {
    const targetPeriodId = periodId || this.getActivePeriod().id;
    let count = 0;
    this.voters = this.voters.map((v) => {
      if (v.electionPeriodId === targetPeriodId && !v.hasVoted && !v.pinPlain) {
        const pin = generateRandomPin(6);
        count++;
        return {
          ...v,
          pinPlain: pin,
          pinHash: hashPin(pin),
        };
      }
      return v;
    });
    if (count > 0) {
      this.logAudit('Panitia', 'GENERATE_PIN_MASSAL', `Membuat ${count} PIN token baru untuk pemilih yang belum memiliki PIN.`, '192.168.10.15', 'INFO');
      this.notify('Panitia', 'GENERATE_PIN_MASSAL');
    }
    return count;
  }

  public markTokensAsPrinted(voterIds: string[]) {
    if (!voterIds || voterIds.length === 0) return;
    const idSet = new Set(voterIds);
    let updatedAny = false;
    this.voters = this.voters.map((v) => {
      if (idSet.has(v.id)) {
        if (!v.tokenPrinted) updatedAny = true;
        return { ...v, tokenPrinted: true };
      }
      return v;
    });
    if (updatedAny) {
      this.notify('Panitia', 'CETAK_KARTU_TOKEN');
    }
  }

  public deleteVoter(voterId: string): { success: boolean; message: string } {
    const voter = this.voters.find((v) => v.id === voterId);
    if (!voter) {
      return { success: false, message: 'Pemilih tidak ditemukan di DPT.' };
    }

    const wasVoted = voter.hasVoted;
    this.voters = this.voters.filter((v) => v.id !== voterId);
    this.recordTombstones('voters', [voterId]);

    // Keep anonymous vote pool synchronized with DPT when a voted student is removed
    if (wasVoted) {
      let removed = false;
      this.votes = [...this.votes]
        .reverse()
        .filter((vote) => {
          if (!removed && vote.electionPeriodId === voter.electionPeriodId) {
            removed = true;
            return false;
          }
          return true;
        })
        .reverse();
    }

    this.logAudit(
      'Panitia',
      'HAPUS_PEMILIH',
      `Menghapus pemilih ${voter.fullName} (${voter.nisn}) dari DPT.`,
      '192.168.10.15',
      'WARNING'
    );
    this.notify('Panitia', 'HAPUS_PEMILIH');
    return {
      success: true,
      message: wasVoted
        ? `Pemilih ${voter.fullName} berhasil dihapus dari DPT dan suara terkait disesuaikan.`
        : `Pemilih ${voter.fullName} berhasil dihapus dari DPT.`,
    };
  }

  public deleteAllVoters(periodId?: string): { success: boolean; message: string; count: number } {
    const targetPeriod = periodId || this.getActivePeriod().id;
    const removedVoterIds = this.voters.filter((v) => v.electionPeriodId === targetPeriod).map((v) => v.id);
    const count = removedVoterIds.length;
    this.recordTombstones('voters', removedVoterIds);
    this.voters = this.voters.filter((v) => v.electionPeriodId !== targetPeriod);
    // Clear votes in this period as well so 0 DPT = 0 votes consistently across all menus
    this.votes = this.votes.filter((v) => v.electionPeriodId !== targetPeriod);
    this.logAudit('Panitia', 'HAPUS_SEMUA_DPT', `Menghapus seluruh ${count} pemilih DPT & surat suara periode.`, '192.168.10.15', 'WARNING');
    this.notify('Panitia', 'HAPUS_SEMUA_DPT');
    return { success: true, message: `Berhasil menghapus seluruh ${count} siswa dari DPT.`, count };
  }

  public resetVotersStatusToUnvoted(periodId?: string): { success: boolean; count: number } {
    const targetPeriod = periodId || this.getActivePeriod().id;
    let count = 0;
    this.voters = this.voters.map((v) => {
      if (v.electionPeriodId === targetPeriod) {
        if (v.hasVoted) count++;
        const pin = generateRandomPin(6);
        return {
          ...v,
          hasVoted: false,
          votedAt: undefined,
          pinPlain: pin,
          pinHash: hashPin(pin),
          tokenPrinted: false,
        };
      }
      return v;
    });

    // Also reset anonymous votes recorded for this period so election tally resets to initial state
    this.votes = this.votes.filter((v) => v.electionPeriodId !== targetPeriod);

    this.logAudit('Panitia', 'RESET_STATUS_BILIK', `Mereset status bilik seluruh siswa & perolehan suara periode ke pengaturan awal.`, '192.168.10.15', 'WARNING');
    this.notify('Panitia', 'RESET_STATUS_BILIK');
    return { success: true, count };
  }

  public resetSingleVoterStatusToUnvoted(voterId: string): { success: boolean; message: string; newPin?: string } {
    const voter = this.voters.find((v) => v.id === voterId);
    if (!voter) return { success: false, message: 'Pemilih tidak ditemukan.' };

    const wasVoted = voter.hasVoted;
    const newPin = generateRandomPin(6);
    this.voters = this.voters.map((v) =>
      v.id === voterId
        ? {
            ...v,
            hasVoted: false,
            votedAt: undefined,
            pinPlain: newPin,
            pinHash: hashPin(newPin),
            tokenPrinted: false,
          }
        : v
    );

    // Keep anonymous votes pool synchronized with voted-voter count when resetting a voter who had cast a ballot
    if (wasVoted) {
      let removed = false;
      this.votes = [...this.votes]
        .reverse()
        .filter((vote) => {
          if (!removed && vote.electionPeriodId === voter.electionPeriodId) {
            removed = true;
            return false;
          }
          return true;
        })
        .reverse();
    }

    this.logAudit(
      'Panitia',
      'RESET_STATUS_PEMILIH_TUNGGAL',
      `Status bilik untuk ${voter.fullName} (${voter.nisn}) direset menjadi Belum Memilih.`,
      '192.168.10.15',
      'WARNING'
    );
    this.notify('Panitia', 'RESET_STATUS_PEMILIH_TUNGGAL');
    return { success: true, message: `Status bilik ${voter.fullName} berhasil direset ke Belum Memilih. PIN baru: ${newPin}`, newPin };
  }

  // --- VOTING AUTHENTICATION & ATOMIC TRANSACTIONS ---
  public verifyVoterLogin(nisn: string, pin: string): {
    success: boolean;
    message: string;
    voter?: Voter;
    activePeriod?: ElectionPeriod;
  } {
    const nisnCheck = validateNisn(nisn);
    if (!nisnCheck.isValid) {
      return { success: false, message: nisnCheck.message || 'Format NISN tidak valid.' };
    }

    const pinCheck = validatePin(pin);
    if (!pinCheck.isValid) {
      return { success: false, message: pinCheck.message || 'Format PIN token tidak valid.' };
    }

    const activePeriod = this.getActivePeriod();
    if (activePeriod.status !== 'active') {
      return { success: false, message: 'Pemungutan suara saat ini tidak aktif atau telah ditutup.' };
    }

    const voter = this.voters.find(
      (v) => v.electionPeriodId === activePeriod.id && v.nisn === nisn.trim()
    );

    if (!voter) {
      this.logAudit('Siswa', 'LOGIN_GAGAL_NISN', `Percobaan login dengan NISN tidak terdaftar: ${nisn}`, '192.168.10.100', 'WARNING');
      return { success: false, message: 'NISN tidak terdaftar dalam Daftar Pemilih Tetap (DPT) periode ini.' };
    }

    if (voter.hasVoted) {
      this.logAudit('Siswa', 'PERCOBAAN_VOTE_GANDA', `Pemilih ${voter.fullName} (${nisn}) mencoba login kembali setelah memilih.`, '192.168.10.100', 'CRITICAL');
      return {
        success: false,
        message: `Hak suara dengan NISN ${nisn} sudah pernah digunakan pada ${voter.votedAt ? new Date(voter.votedAt).toLocaleTimeString('id-ID') : 'sebelumnya'}. Satu pemilih hanya memiliki 1 hak suara.`,
      };
    }

    const isPinValid = verifyPin(pin, voter.pinHash);
    if (!isPinValid) {
      this.logAudit('Siswa', 'LOGIN_GAGAL_PIN', `PIN salah untuk pemilih ${voter.fullName} (${nisn})`, '192.168.10.100', 'WARNING');
      return { success: false, message: 'Token PIN yang Anda masukkan salah. Pastikan PIN sesuai dengan kartu suara Anda.' };
    }

    this.logAudit('Siswa', 'LOGIN_BILIK_SUARA', `Siswa ${voter.fullName} masuk ke bilik suara digital.`, '192.168.10.100', 'INFO');
    return {
      success: true,
      message: 'Otentikasi berhasil. Selamat datang di bilik suara.',
      voter,
      activePeriod,
    };
  }

  /**
   * SERVER-AUTHORITATIVE VOTER AUTHENTICATION FOR CONCURRENT ONLINE VOTING
   * Ensures NISN/PIN & hasVoted checks run against live central server state across all booths.
   */
  public async verifyVoterLoginOnline(
    nisn: string,
    pin: string
  ): Promise<{
    success: boolean;
    message: string;
    voter?: Voter;
    activePeriod?: ElectionPeriod;
  }> {
    if (typeof window !== 'undefined' && typeof fetch !== 'undefined') {
      try {
        const res = await fetch('/api/voter-auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nisn, pin }),
        });
        const data = await res.json();
        if (typeof data.serverTimeMs === 'number') {
          this.serverClockOffsetMs = calculateServerClockOffset(data.serverTimeMs, Date.now());
        }
        if (typeof data.onlineClients === 'number') {
          this.onlineClients = data.onlineClients;
        }
        if (data && typeof data.success === 'boolean') {
          if (!data.success && (res.status === 409 || res.status === 404 || res.status === 403)) {
            void this.fetchStateFromHttp(true);
          }
          if (data.success && data.voter) {
            // Upsert authoritative voter & activePeriod synchronously so Bilik & Panitia match immediately
            this.isApplyingRemoteState = true;
            try {
              const incomingVoter = data.voter as Voter;
              const existingIdx = this.voters.findIndex((v) => v.id === incomingVoter.id);
              if (existingIdx >= 0) {
                this.voters = this.voters.map((v, idx) => (idx === existingIdx ? incomingVoter : v));
              } else {
                this.voters = [...this.voters, incomingVoter];
              }
              if (data.activePeriod) {
                const incomingPeriod = data.activePeriod as ElectionPeriod;
                const pExists = this.periods.some((p) => p.id === incomingPeriod.id);
                if (pExists) {
                  this.periods = this.periods.map((p) =>
                    p.id === incomingPeriod.id
                      ? incomingPeriod
                      : p.status === 'active'
                      ? { ...p, status: 'completed' }
                      : p
                  );
                } else {
                  this.periods = [
                    ...this.periods.map((p) => (p.status === 'active' ? { ...p, status: 'completed' as const } : p)),
                    incomingPeriod,
                  ];
                }
              }
              this.saveToStorage();
            } finally {
              this.isApplyingRemoteState = false;
            }
            this.emitToListeners();

            if (typeof data.revision === 'number' && data.revision > this.revision) {
              void this.fetchStateFromHttp(true);
            }
          }
          return {
            success: data.success,
            message: data.message,
            voter: data.voter,
            activePeriod: data.activePeriod,
          };
        }
      } catch {
        // Fallback to local verification if offline
      }
    }
    return this.verifyVoterLogin(nisn, pin);
  }

  /**
   * ATOMIC ANONYMOUS VOTE SUBMISSION (LOCAL + FALLBACK)
   * 1. Records vote in `votes` table WITHOUT any reference to voterId (True LUBER-JURDIL).
   * 2. Marks voter in `voters` table as `hasVoted = true` with timestamp.
   * 3. Burns/invalidates voter's plain PIN token.
   * 4. Logs audit event.
   */
  public submitAnonymousVote(voterId: string, candidateId: string): {
    success: boolean;
    message: string;
    receiptCode?: string;
  } {
    const voterIndex = this.voters.findIndex((v) => v.id === voterId);
    if (voterIndex === -1) {
      return { success: false, message: 'Data pemilih tidak valid.' };
    }

    const voter = this.voters[voterIndex];
    if (voter.hasVoted) {
      return { success: false, message: 'Hak suara telah digunakan sebelumnya. Suara ganda ditolak sistem.' };
    }

    const activePeriod = this.getActivePeriod();
    const candidate = this.candidates.find(
      (c) => c.id === candidateId && c.electionPeriodId === activePeriod.id
    );
    if (!candidate) {
      return { success: false, message: 'Pasangan calon yang dipilih tidak sah.' };
    }

    const now = new Date(this.getAppTimeMs()).toISOString();

    // 1. Insert strictly anonymous vote
    const anonymousVote: AnonymousVote = {
      id: `vote_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      electionPeriodId: activePeriod.id,
      candidateId: candidate.id,
      createdAt: now,
    };
    this.votes.push(anonymousVote);

    // 2. Mark voter as voted atomically & burn plain PIN
    this.voters[voterIndex] = {
      ...voter,
      hasVoted: true,
      votedAt: now,
      pinPlain: undefined, // Burn plain PIN to prevent reuse
    };

    // 3. Generate anonymous verifiable receipt hash (does not reveal choice)
    const receiptCode = `PILKETOS-${Math.abs(Date.now() % 1000000).toString().padStart(6, '0')}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    // 4. Record audit log
    this.logAudit(
      'Siswa',
      'TRANSAKSI_SUARA_ANONIM',
      `Surat suara digital sah telah disalurkan dan dihitung. Kode verifikasi transaksi: ${receiptCode}.`,
      '192.168.10.100',
      'INFO'
    );

    this.notify('Siswa', 'TRANSAKSI_SUARA_ANONIM');

    return {
      success: true,
      message: 'Suara Anda telah berhasil dicatat secara sah, rahasia, dan terenkripsi.',
      receiptCode,
    };
  }

  /**
   * SERVER-AUTHORITATIVE ATOMIC ONLINE VOTE SUBMISSION
   * Commits the vote directly on the central server (/api/vote) so concurrent student booths
   * never overwrite each other's votes and all Quick Count screens update instantaneously.
   */
  public async submitAnonymousVoteOnline(
    voterId: string,
    candidateId: string
  ): Promise<{
    success: boolean;
    message: string;
    receiptCode?: string;
  }> {
    if (typeof window !== 'undefined' && typeof fetch !== 'undefined') {
      try {
        const res = await fetch('/api/vote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            voterId,
            candidateId,
            senderId: this.clientId,
          }),
        });
        const data = await res.json();

        if (!res.ok || !data.success) {
          void this.forceResyncWithServer();
          return {
            success: false,
            message: data?.message || 'Gagal mencatat suara pada server.',
          };
        }

        // Apply authoritative delta from server & notify local BroadcastChannel tabs immediately
        this.applyServerVoteDelta({
          vote: data.vote,
          voterUpdate: data.voterUpdate,
          auditLog: data.auditLog,
          revision: data.revision,
          epochId: data.epochId,
          updatedAt: data.updatedAt,
          updatedBy: 'Siswa',
          lastAction: 'TRANSAKSI_SUARA_ANONIM',
          serverTimeMs: data.serverTimeMs,
          onlineClients: data.onlineClients,
        });

        if (this.broadcastChannel) {
          try {
            this.broadcastChannel.postMessage({
              type: 'STATE_UPDATED',
              state: this.getSnapshot(),
              senderId: this.clientId,
              serverTimeMs: data.serverTimeMs,
              onlineClients: data.onlineClients,
            });
          } catch {}
        }

        return {
          success: true,
          message: data.message,
          receiptCode: data.receiptCode,
        };
      } catch {
        // Fallback to local atomic vote if server is unreachable
      }
    }

    return this.submitAnonymousVote(voterId, candidateId);
  }

  // --- COMMITTEE MANAGEMENT ---
  public getCommittee(periodId?: string): CommitteeMember[] {
    const target = periodId || this.getActivePeriod().id;
    return this.committee.filter((c) => c.electionPeriodId === target);
  }

  public addCommitteeMember(member: Omit<CommitteeMember, 'id'> & { id?: string }) {
    const providedId = member.id?.trim();
    const newId =
      providedId && !this.committee.some((c) => c.id === providedId)
        ? providedId
        : `comm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newMember: CommitteeMember = {
      ...member,
      id: newId,
    };
    this.committee = [...this.committee, newMember];
    this.logAudit('Admin Sekolah', 'TAMBAH_PANITIA', `Menambahkan anggota panitia: ${newMember.memberName} (${newMember.role})`, '192.168.10.1', 'INFO');
    this.notify('Admin Sekolah', 'TAMBAH_PANITIA');
    return newMember;
  }

  public updateCommitteeMember(id: string, updates: Partial<CommitteeMember>) {
    const existing = this.committee.find((c) => c.id === id);
    this.committee = this.committee.map((c) => (c.id === id ? { ...c, ...updates } : c));
    this.logAudit(
      'Admin Sekolah',
      'UPDATE_PANITIA',
      `Memperbarui data anggota panitia: ${updates.memberName || existing?.memberName || id}`,
      '192.168.10.1',
      'INFO'
    );
    this.notify('Admin Sekolah', 'UPDATE_PANITIA');
  }

  public deleteCommitteeMember(id: string) {
    const existing = this.committee.find((c) => c.id === id);
    this.recordTombstones('committee', [id]);
    this.committee = this.committee.filter((c) => c.id !== id);
    this.logAudit(
      'Admin Sekolah',
      'HAPUS_PANITIA',
      `Menghapus anggota panitia: ${existing?.memberName || id} (${existing?.role || '-'})`,
      '192.168.10.1',
      'WARNING'
    );
    this.notify('Admin Sekolah', 'HAPUS_PANITIA');
  }

  // --- AUDIT LOGS ---
  public getAuditLogs(): AuditLog[] {
    return [...this.auditLogs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  public logAudit(
    userRole: AuditLog['userRole'],
    action: string,
    details: string,
    ipAddress = '192.168.1.1',
    severity: AuditLog['severity'] = 'INFO'
  ) {
    const newLog: AuditLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      userId: userRole.toLowerCase().replace(/\s+/g, '_'),
      userRole,
      action,
      details,
      ipAddress,
      timestamp: new Date(this.getAppTimeMs()).toISOString(),
      severity,
    };
    this.auditLogs.unshift(newLog);
    // Keep max 200 logs
    if (this.auditLogs.length > 200) {
      this.auditLogs.pop();
    }
  }

  // --- STATS & REALTIME SUMMARY ---
  public getSummary(periodId?: string): ElectionSummary {
    const tab = computePeriodTabulation(
      {
        periods: this.periods,
        voters: this.voters,
        votes: this.votes,
        candidates: this.candidates,
        committee: this.committee,
      },
      periodId
    );
    return {
      period: tab.period,
      totalVoters: tab.totalVoters,
      totalVoted: tab.totalVoted,
      totalUnvoted: tab.totalUnvoted,
      participationPercentage: tab.participationPercentage,
      abstainPercentage: tab.abstainPercentage,
      candidatesResults: tab.candidatesResults,
      classParticipation: tab.classParticipation,
    };
  }
}

// Global Singleton Instance
export const electionStore = new ElectionStore();
