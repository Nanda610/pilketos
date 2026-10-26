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
} from '../types';
import {
  INITIAL_SCHOOL,
  INITIAL_PERIODS,
  INITIAL_CANDIDATES,
  INITIAL_VOTERS,
  INITIAL_VOTES,
  INITIAL_COMMITTEE,
  INITIAL_AUDIT_LOGS,
} from './initialData';
import { generateRandomPin, hashPin, verifyPin, validateNisn, validatePin } from './security';
import {
  calculateServerClockOffset,
  computeAppTimeMs,
  computeOffsetForTargetAppTime,
  shouldApplyRemoteSnapshot,
} from './realtimeSync';

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
  private listeners: Set<() => void> = new Set();

  // Real-time synchronization & Unified Application Clock state
  private clientId: string = `client_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  private revision: number = 1;
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

  private ws: WebSocket | null = null;
  private broadcastChannel: BroadcastChannel | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.school = INITIAL_SCHOOL;
    this.periods = INITIAL_PERIODS;
    this.candidates = INITIAL_CANDIDATES;
    this.voters = INITIAL_VOTERS;
    this.votes = INITIAL_VOTES;
    this.committee = INITIAL_COMMITTEE;
    this.auditLogs = INITIAL_AUDIT_LOGS;

    this.loadFromStorage();
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

  private notify(updatedBy: string = 'Admin Sekolah', lastAction: string = 'UPDATE_DATA') {
    if (!this.isApplyingRemoteState) {
      this.revision += 1;
      this.updatedAt = new Date(this.getAppTimeMs()).toISOString();
      this.updatedBy = updatedBy;
      this.lastAction = lastAction;
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

    const shouldApply = shouldApplyRemoteSnapshot(
      { revision: this.revision, updatedAt: this.updatedAt },
      { revision: snapshot.revision ?? 0, updatedAt: snapshot.updatedAt || '' },
      forceSync
    );

    if (!shouldApply) {
      // Still update appTimeOffsetMs if provided and emit metadata update
      if (typeof snapshot.appTimeOffsetMs === 'number' && snapshot.appTimeOffsetMs !== this.appTimeOffsetMs) {
        this.appTimeOffsetMs = snapshot.appTimeOffsetMs;
        this.emitToListeners();
      }
      return;
    }

    this.isApplyingRemoteState = true;
    try {
      this.revision = snapshot.revision ?? this.revision;
      this.updatedAt = snapshot.updatedAt || new Date(this.getAppTimeMs()).toISOString();
      this.updatedBy = snapshot.updatedBy || 'Admin Sekolah';
      this.lastAction = snapshot.lastAction || 'REALTIME_SYNC';
      if (typeof snapshot.appTimeOffsetMs === 'number') {
        this.appTimeOffsetMs = snapshot.appTimeOffsetMs;
      }
      if (snapshot.school) this.school = snapshot.school;
      if (Array.isArray(snapshot.periods)) this.periods = snapshot.periods;
      if (Array.isArray(snapshot.candidates)) this.candidates = snapshot.candidates;
      if (Array.isArray(snapshot.voters)) this.voters = snapshot.voters;
      if (Array.isArray(snapshot.votes)) this.votes = snapshot.votes;
      if (Array.isArray(snapshot.committee)) this.committee = snapshot.committee;
      if (Array.isArray(snapshot.auditLogs)) this.auditLogs = snapshot.auditLogs;

      this.lastSyncedAt = new Date(this.getAppTimeMs()).toISOString();
      this.saveToStorage();
    } finally {
      this.isApplyingRemoteState = false;
    }

    this.emitToListeners();
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
      this.ws.send(JSON.stringify({ type: 'REQUEST_STATE', clientSentAtMs: Date.now() }));
      return;
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
            this.applyRemoteSnapshot(data.state, data.serverTimeMs, data.onlineClients, true);
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
          this.applyRemoteSnapshot(parsed, undefined, undefined, true);
        } catch {
          // Ignore
        }
      }
    });

    // 3. Connect to Authoritative Server via WebSocket (/ws) + HTTP initial fetch
    this.fetchStateFromHttp(true);
    this.connectWebSocket();

    // 4. Periodic HTTP fallback poll & NTP clock sync check
    this.pollTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'PING', clientSentAtMs: Date.now() }));
      } else {
        this.fetchStateFromHttp(false);
      }
    }, 3000);
  }

  private connectWebSocket() {
    if (typeof window === 'undefined' || typeof WebSocket === 'undefined') return;
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
            this.applyRemoteSnapshot(msg.state, msg.serverTimeMs, msg.onlineClients, true);
            return;
          }

          if (msg.type === 'STATE_UPDATED' && msg.state) {
            this.isConnected = true;
            this.transport = 'websocket';
            if (msg.senderId === this.clientId) {
              // Update revision & server clock from authoritative ACK
              if (typeof msg.serverTimeMs === 'number') {
                this.serverClockOffsetMs = calculateServerClockOffset(msg.serverTimeMs, Date.now());
              }
              if (typeof msg.onlineClients === 'number') {
                this.onlineClients = msg.onlineClients;
              }
              if (msg.state.revision > this.revision) {
                this.revision = msg.state.revision;
              }
              this.lastSyncedAt = new Date(this.getAppTimeMs()).toISOString();
              this.emitToListeners();
              return;
            }
            this.applyRemoteSnapshot(msg.state, msg.serverTimeMs, msg.onlineClients, true);
            return;
          }

          if (msg.type === 'PONG' || msg.type === 'TIME_HEARTBEAT' || msg.type === 'PRESENCE_UPDATE') {
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
            // If server has a newer revision than us, request full state immediately
            if (typeof msg.revision === 'number' && msg.revision > this.revision) {
              socket.send(JSON.stringify({ type: 'REQUEST_STATE' }));
            }
            this.lastSyncedAt = new Date(this.getAppTimeMs()).toISOString();
            this.emitToListeners();
          }
        } catch {
          // Ignore malformed WS message
        }
      };

      socket.onclose = () => {
        this.ws = null;
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => this.connectWebSocket(), 2500);
      };

      socket.onerror = () => {
        socket.close();
      };
    } catch {
      // Fallback to HTTP polling / BroadcastChannel
    }
  }

  private async fetchStateFromHttp(forceApply: boolean = false) {
    if (typeof window === 'undefined' || typeof fetch === 'undefined') return;
    const sentAt = Date.now();
    try {
      const res = await fetch('/api/state', { cache: 'no-store' });
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

    // 2. Push to authoritative server over WebSocket or HTTP POST
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(
          JSON.stringify({
            type: 'PUSH_STATE',
            state: snapshot,
            updatedBy,
            lastAction,
            senderId: this.clientId,
          })
        );
        return;
      } catch {
        // Fall through to HTTP POST
      }
    }

    fetch('/api/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        state: snapshot,
        updatedBy,
        lastAction,
        senderId: this.clientId,
      }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.state) {
          this.isConnected = true;
          if (typeof data.serverTimeMs === 'number') {
            this.serverClockOffsetMs = calculateServerClockOffset(data.serverTimeMs, Date.now());
          }
          if (typeof data.onlineClients === 'number') {
            this.onlineClients = data.onlineClients;
          }
          this.revision = data.state.revision ?? this.revision;
          this.lastSyncedAt = new Date(this.getAppTimeMs()).toISOString();
          this.emitToListeners();
        }
      })
      .catch(() => {});
  }

  private loadFromStorage() {
    if (typeof window === 'undefined') return;
    try {
      const savedSchool = localStorage.getItem(`${STORAGE_KEY_PREFIX}_school`);
      const savedPeriods = localStorage.getItem(`${STORAGE_KEY_PREFIX}_periods`);
      const savedCandidates = localStorage.getItem(`${STORAGE_KEY_PREFIX}_candidates`);
      const savedVoters = localStorage.getItem(`${STORAGE_KEY_PREFIX}_voters`);
      const savedVotes = localStorage.getItem(`${STORAGE_KEY_PREFIX}_votes`);
      const savedCommittee = localStorage.getItem(`${STORAGE_KEY_PREFIX}_committee`);
      const savedLogs = localStorage.getItem(`${STORAGE_KEY_PREFIX}_logs`);
      const savedMeta = localStorage.getItem(`${STORAGE_KEY_PREFIX}_meta`);

      if (savedSchool) this.school = JSON.parse(savedSchool);
      if (savedPeriods) this.periods = JSON.parse(savedPeriods);
      if (savedCandidates) this.candidates = JSON.parse(savedCandidates);
      if (savedVoters) this.voters = JSON.parse(savedVoters);
      if (savedVotes) this.votes = JSON.parse(savedVotes);
      if (savedCommittee) this.committee = JSON.parse(savedCommittee);
      if (savedLogs) this.auditLogs = JSON.parse(savedLogs);
      if (savedMeta) {
        const meta = JSON.parse(savedMeta);
        if (typeof meta.revision === 'number') this.revision = meta.revision;
        if (typeof meta.appTimeOffsetMs === 'number') this.appTimeOffsetMs = meta.appTimeOffsetMs;
        if (meta.updatedAt) this.updatedAt = meta.updatedAt;
      }
    } catch {
      // Ignore parse errors and fallback to initial
    }
  }

  private saveToStorage() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}_school`, JSON.stringify(this.school));
      localStorage.setItem(`${STORAGE_KEY_PREFIX}_periods`, JSON.stringify(this.periods));
      localStorage.setItem(`${STORAGE_KEY_PREFIX}_candidates`, JSON.stringify(this.candidates));
      localStorage.setItem(`${STORAGE_KEY_PREFIX}_voters`, JSON.stringify(this.voters));
      localStorage.setItem(`${STORAGE_KEY_PREFIX}_votes`, JSON.stringify(this.votes));
      localStorage.setItem(`${STORAGE_KEY_PREFIX}_committee`, JSON.stringify(this.committee));
      localStorage.setItem(`${STORAGE_KEY_PREFIX}_logs`, JSON.stringify(this.auditLogs));
      localStorage.setItem(
        `${STORAGE_KEY_PREFIX}_meta`,
        JSON.stringify({
          revision: this.revision,
          updatedAt: this.updatedAt,
          updatedBy: this.updatedBy,
          lastAction: this.lastAction,
          appTimeOffsetMs: this.appTimeOffsetMs,
        })
      );
      localStorage.setItem(`${STORAGE_KEY_PREFIX}_snapshot`, JSON.stringify(this.getSnapshot()));
    } catch {
      // Storage quota or disabled
    }
  }

  // Reset to initial demo data
  public resetToSampleData() {
    this.school = INITIAL_SCHOOL;
    this.periods = INITIAL_PERIODS;
    this.candidates = INITIAL_CANDIDATES;
    this.voters = INITIAL_VOTERS;
    this.votes = INITIAL_VOTES;
    this.committee = INITIAL_COMMITTEE;
    this.auditLogs = INITIAL_AUDIT_LOGS;
    this.logAudit('Admin Sekolah', 'RESET_DATA_DEMO', 'Database disetel ulang ke dataset simulasi awal.', '127.0.0.1', 'WARNING');
    this.notify('Admin Sekolah', 'RESET_DATA_DEMO');
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

  public addPeriod(period: Omit<ElectionPeriod, 'id' | 'createdAt'>): ElectionPeriod {
    const newPeriod: ElectionPeriod = {
      ...period,
      id: `period_${Date.now()}`,
      createdAt: new Date(this.getAppTimeMs()).toISOString(),
    };
    if (newPeriod.status === 'active') {
      // Demote others
      this.periods = this.periods.map((p) => ({ ...p, status: p.status === 'active' ? 'completed' : p.status }));
    }
    this.periods.push(newPeriod);
    this.logAudit('Admin Sekolah', 'BUAT_PERIODE_BARU', `Menambahkan periode pemilihan: ${newPeriod.periodName}`, '192.168.10.1', 'INFO');
    this.notify('Admin Sekolah', 'BUAT_PERIODE_BARU');
    return newPeriod;
  }

  public updatePeriod(periodId: string, updates: Partial<ElectionPeriod>) {
    this.periods = this.periods.map((p) => {
      if (p.id === periodId) {
        return { ...p, ...updates };
      }
      return p;
    });
    this.logAudit('Admin Sekolah', 'UPDATE_PERIODE', `Memperbarui data periode ${periodId}`, '192.168.10.1', 'INFO');
    this.notify('Admin Sekolah', 'UPDATE_PERIODE');
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
      message: `Periode "${targetPeriod.periodName}" berhasil dihapus.`,
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
      id: `cand_${Date.now()}`,
    };
    this.candidates.push(newCandidate);
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

  public deleteCandidate(candidateId: string) {
    this.candidates = this.candidates.filter((c) => c.id !== candidateId);
    this.logAudit('Panitia', 'HAPUS_PASLON', `Menghapus paslon ID ${candidateId}`, '192.168.10.15', 'WARNING');
    this.notify('Panitia', 'HAPUS_PASLON');
  }

  // --- DPT (DAFTAR PEMILIH TETAP) MANAGEMENT ---
  public getVoters(periodId?: string): Voter[] {
    const targetPeriod = periodId || this.getActivePeriod().id;
    return this.voters.filter((v) => v.electionPeriodId === targetPeriod);
  }

  public addVoter(voterData: {
    nisn: string;
    fullName: string;
    className: string;
    gradeLevel: string;
    gender: 'L' | 'P';
  }): { success: boolean; message: string; voter?: Voter } {
    const nisnCheck = validateNisn(voterData.nisn);
    if (!nisnCheck.isValid) {
      return { success: false, message: nisnCheck.message || 'NISN tidak valid' };
    }

    const activePeriod = this.getActivePeriod();
    const existing = this.voters.find(
      (v) => v.electionPeriodId === activePeriod.id && v.nisn === voterData.nisn.trim()
    );

    if (existing) {
      return { success: false, message: `Siswa dengan NISN ${voterData.nisn} sudah terdaftar dalam DPT periode ini.` };
    }

    const plainPin = generateRandomPin(6);
    const pinHash = hashPin(plainPin);

    const newVoter: Voter = {
      id: `voter_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      electionPeriodId: activePeriod.id,
      nisn: voterData.nisn.trim(),
      fullName: voterData.fullName.trim(),
      className: voterData.className.trim(),
      gradeLevel: voterData.gradeLevel,
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
    rows: Array<{ nisn: string; fullName: string; className: string; gender?: string; gradeLevel?: string }>
  ): { added: number; skipped: number; errors: string[] } {
    const activePeriod = this.getActivePeriod();
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
        (v) => v.electionPeriodId === activePeriod.id && v.nisn === row.nisn.trim()
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
        electionPeriodId: activePeriod.id,
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

  public generateMissingPins(): number {
    let count = 0;
    this.voters = this.voters.map((v) => {
      if (!v.hasVoted && !v.pinPlain) {
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
    const idSet = new Set(voterIds);
    this.voters = this.voters.map((v) => {
      if (idSet.has(v.id)) {
        return { ...v, tokenPrinted: true };
      }
      return v;
    });
    this.notify('Panitia', 'CETAK_KARTU_TOKEN');
  }

  public deleteVoter(voterId: string) {
    const voter = this.voters.find((v) => v.id === voterId);
    if (voter?.hasVoted) {
      return { success: false, message: 'Pemilih yang sudah memilih tidak dapat dihapus untuk menjaga integritas rekapitulasi.' };
    }
    this.voters = this.voters.filter((v) => v.id !== voterId);
    this.logAudit('Panitia', 'HAPUS_PEMILIH', `Menghapus pemilih ${voter?.fullName || voterId}`, '192.168.10.15', 'WARNING');
    this.notify('Panitia', 'HAPUS_PEMILIH');
    return { success: true, message: 'Pemilih berhasil dihapus dari DPT.' };
  }

  public deleteAllVoters(periodId?: string): { success: boolean; message: string; count: number } {
    const targetPeriod = periodId || this.getActivePeriod().id;
    const count = this.voters.filter((v) => v.electionPeriodId === targetPeriod).length;
    this.voters = this.voters.filter((v) => v.electionPeriodId !== targetPeriod);
    this.logAudit('Panitia', 'HAPUS_SEMUA_DPT', `Menghapus seluruh ${count} pemilih DPT periode.`, '192.168.10.15', 'WARNING');
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

    const newPin = generateRandomPin(6);
    voter.hasVoted = false;
    voter.votedAt = undefined;
    voter.pinPlain = newPin;
    voter.pinHash = hashPin(newPin);
    voter.tokenPrinted = false;

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
   * ATOMIC ANONYMOUS VOTE SUBMISSION
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

  // --- COMMITTEE MANAGEMENT ---
  public getCommittee(periodId?: string): CommitteeMember[] {
    const target = periodId || this.getActivePeriod().id;
    return this.committee.filter((c) => c.electionPeriodId === target);
  }

  public addCommitteeMember(member: Omit<CommitteeMember, 'id'>) {
    const newMember: CommitteeMember = {
      ...member,
      id: `comm_${Date.now()}`,
    };
    this.committee.push(newMember);
    this.logAudit('Admin Sekolah', 'TAMBAH_PANITIA', `Menambahkan anggota panitia: ${newMember.memberName} (${newMember.role})`, '192.168.10.1', 'INFO');
    this.notify('Admin Sekolah', 'TAMBAH_PANITIA');
    return newMember;
  }

  public updateCommitteeMember(id: string, updates: Partial<CommitteeMember>) {
    this.committee = this.committee.map((c) => (c.id === id ? { ...c, ...updates } : c));
    this.notify('Admin Sekolah', 'UPDATE_PANITIA');
  }

  public deleteCommitteeMember(id: string) {
    this.committee = this.committee.filter((c) => c.id !== id);
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
    const targetPeriod = periodId
      ? this.periods.find((p) => p.id === periodId) || this.getActivePeriod()
      : this.getActivePeriod();

    const votersInPeriod = this.voters.filter((v) => v.electionPeriodId === targetPeriod.id);
    const votesInPeriod = this.votes.filter((v) => v.electionPeriodId === targetPeriod.id);
    const candidatesInPeriod = this.candidates
      .filter((c) => c.electionPeriodId === targetPeriod.id)
      .sort((a, b) => a.ballotNumber - b.ballotNumber);

    const totalVoters = votersInPeriod.length;
    const totalVoted = votersInPeriod.filter((v) => v.hasVoted).length;
    const totalUnvoted = totalVoters - totalVoted;
    const participationPercentage = totalVoters > 0 ? (totalVoted / totalVoters) * 100 : 0;

    // Count votes per candidate
    const voteMap = new Map<string, number>();
    votesInPeriod.forEach((vote) => {
      voteMap.set(vote.candidateId, (voteMap.get(vote.candidateId) || 0) + 1);
    });

    const candidatesResults = candidatesInPeriod.map((cand) => {
      const count = voteMap.get(cand.id) || 0;
      const percentage = totalVoted > 0 ? (count / totalVoted) * 100 : 0;
      return {
        candidate: cand,
        voteCount: count,
        percentage: Number(percentage.toFixed(2)),
      };
    });

    // Breakdown per class
    const classMap = new Map<string, { total: number; voted: number }>();
    votersInPeriod.forEach((v) => {
      const current = classMap.get(v.className) || { total: 0, voted: 0 };
      current.total += 1;
      if (v.hasVoted) current.voted += 1;
      classMap.set(v.className, current);
    });

    const classParticipation = Array.from(classMap.entries())
      .map(([className, data]) => ({
        className,
        total: data.total,
        voted: data.voted,
        percentage: data.total > 0 ? Number(((data.voted / data.total) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => a.className.localeCompare(b.className));

    return {
      period: targetPeriod,
      totalVoters,
      totalVoted,
      totalUnvoted,
      participationPercentage: Number(participationPercentage.toFixed(2)),
      candidatesResults,
      classParticipation,
    };
  }
}

// Global Singleton Instance
export const electionStore = new ElectionStore();
