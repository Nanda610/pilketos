/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Full-Stack Real-Time Authoritative Server for E-Pilketos & E-Pilkosim Digital.
 * Synchronizes all Admin & Panitia changes, Voter ballot transactions, and Unified Application Time
 * across all connected clients in real-time via WebSocket (/ws) and HTTP REST (/api/state, /api/time).
 */

import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';
import path from 'path';
import {
  INITIAL_SCHOOL,
  INITIAL_PERIODS,
  INITIAL_CANDIDATES,
  INITIAL_VOTERS,
  INITIAL_VOTES,
  INITIAL_COMMITTEE,
  INITIAL_AUDIT_LOGS,
  INITIAL_ACCOUNTS,
} from './src/lib/initialData';
import { ElectionStateSnapshot } from './src/types';

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.join(process.cwd(), '.data');
const STATE_FILE = path.join(DATA_DIR, 'election-state.json');

function createInitialSnapshot(): ElectionStateSnapshot {
  return {
    revision: 1,
    updatedAt: new Date().toISOString(),
    updatedBy: 'Server Utama',
    lastAction: 'INIT_SYSTEM',
    appTimeOffsetMs: 0,
    school: INITIAL_SCHOOL,
    periods: INITIAL_PERIODS,
    candidates: INITIAL_CANDIDATES,
    voters: INITIAL_VOTERS,
    votes: INITIAL_VOTES,
    committee: INITIAL_COMMITTEE,
    auditLogs: INITIAL_AUDIT_LOGS,
    accounts: INITIAL_ACCOUNTS,
  };
}

function loadStateFromDisk(): ElectionStateSnapshot {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<ElectionStateSnapshot>;
      if (parsed && parsed.school && Array.isArray(parsed.periods)) {
        return {
          revision: typeof parsed.revision === 'number' ? parsed.revision : 1,
          updatedAt: parsed.updatedAt || new Date().toISOString(),
          updatedBy: parsed.updatedBy || 'Server Utama',
          lastAction: parsed.lastAction || 'LOAD_DISK',
          appTimeOffsetMs: typeof parsed.appTimeOffsetMs === 'number' ? parsed.appTimeOffsetMs : 0,
          school: parsed.school,
          periods: parsed.periods,
          candidates: Array.isArray(parsed.candidates) ? parsed.candidates : INITIAL_CANDIDATES,
          voters: Array.isArray(parsed.voters) ? parsed.voters : INITIAL_VOTERS,
          votes: Array.isArray(parsed.votes) ? parsed.votes : INITIAL_VOTES,
          committee: Array.isArray(parsed.committee) ? parsed.committee : INITIAL_COMMITTEE,
          auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs : INITIAL_AUDIT_LOGS,
          accounts: Array.isArray(parsed.accounts) ? parsed.accounts : INITIAL_ACCOUNTS,
        };
      }
    }
  } catch (err) {
    console.error('[E-Pilketos Server] Gagal membaca state dari disk, menggunakan data awal:', err);
  }
  return createInitialSnapshot();
}

function saveStateToDisk(state: ElectionStateSnapshot) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(STATE_FILE, JSON.stringify(state), 'utf-8');
  } catch (err) {
    console.error('[E-Pilketos Server] Gagal menyimpan state ke disk:', err);
  }
}

let authoritativeState: ElectionStateSnapshot = loadStateFromDisk();

async function startServer() {
  const app = express();
  const httpServer = createServer(app);

  // CORS & No-Cache middleware to prevent stale responses across proxies, Cloud Run, and multi-browser clients
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.header('Pragma', 'no-cache');
    res.header('Expires', '0');
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  // Support large payloads for custom school logos, candidate photos, and video data URLs
  app.use(express.json({ limit: '60mb' }));

  // WebSocket Server attached to HTTP server on /ws
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  const clients = new Set<WebSocket>();

  const getOnlineCount = () => {
    let count = 0;
    clients.forEach((c) => {
      if (c.readyState === WebSocket.OPEN) count++;
    });
    return Math.max(1, count);
  };

  const broadcastToAll = (payload: Record<string, unknown>, excludeSocket?: WebSocket) => {
    const message = JSON.stringify({
      ...payload,
      serverTimeMs: Date.now(),
      onlineClients: getOnlineCount(),
    });
    clients.forEach((client) => {
      if (client !== excludeSocket && client.readyState === WebSocket.OPEN) {
        try {
          client.send(message);
        } catch {
          clients.delete(client);
        }
      }
    });
  };

  const applyAuthoritativeUpdate = (
    incoming: Partial<ElectionStateSnapshot>,
    updatedBy: string = 'Admin Sekolah',
    lastAction: string = 'SYNC_UPDATE'
  ): ElectionStateSnapshot => {
    const nextOffset =
      typeof incoming.appTimeOffsetMs === 'number'
        ? incoming.appTimeOffsetMs
        : authoritativeState.appTimeOffsetMs;

    const appNowIso = new Date(Date.now() + nextOffset).toISOString();

    const nextRevision =
      Math.max(
        authoritativeState.revision,
        typeof incoming.revision === 'number' ? incoming.revision : 0
      ) + 1;

    authoritativeState = {
      revision: nextRevision,
      updatedAt: appNowIso,
      updatedBy: updatedBy || incoming.updatedBy || 'Admin Sekolah',
      lastAction: lastAction || incoming.lastAction || 'SYNC_UPDATE',
      appTimeOffsetMs: nextOffset,
      school: incoming.school ?? authoritativeState.school,
      periods: incoming.periods ?? authoritativeState.periods,
      candidates: incoming.candidates ?? authoritativeState.candidates,
      voters: incoming.voters ?? authoritativeState.voters,
      votes: incoming.votes ?? authoritativeState.votes,
      committee: incoming.committee ?? authoritativeState.committee,
      auditLogs: incoming.auditLogs ?? authoritativeState.auditLogs,
      accounts: incoming.accounts ?? authoritativeState.accounts ?? INITIAL_ACCOUNTS,
    };

    saveStateToDisk(authoritativeState);
    return authoritativeState;
  };

  wss.on('connection', (ws) => {
    clients.add(ws);

    // 1. Send authoritative state & server clock immediately to newly connected client
    ws.send(
      JSON.stringify({
        type: 'INIT_STATE',
        state: authoritativeState,
        serverTimeMs: Date.now(),
        onlineClients: getOnlineCount(),
      })
    );

    // 2. Notify other clients of updated online presence count
    broadcastToAll(
      {
        type: 'PRESENCE_UPDATE',
        appTimeOffsetMs: authoritativeState.appTimeOffsetMs,
        revision: authoritativeState.revision,
      },
      ws
    );

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());

        if (msg.type === 'PING' || msg.type === 'SYNC_TIME') {
          ws.send(
            JSON.stringify({
              type: 'PONG',
              clientSentAtMs: msg.clientSentAtMs,
              serverTimeMs: Date.now(),
              appTimeOffsetMs: authoritativeState.appTimeOffsetMs,
              revision: authoritativeState.revision,
              onlineClients: getOnlineCount(),
            })
          );
          return;
        }

        if (msg.type === 'REQUEST_STATE') {
          ws.send(
            JSON.stringify({
              type: 'INIT_STATE',
              state: authoritativeState,
              serverTimeMs: Date.now(),
              onlineClients: getOnlineCount(),
            })
          );
          return;
        }

        if (msg.type === 'PUSH_STATE' && msg.state) {
          const updated = applyAuthoritativeUpdate(
            msg.state,
            msg.updatedBy || msg.state.updatedBy || 'Admin Sekolah',
            msg.lastAction || msg.state.lastAction || 'STATE_MUTATION'
          );

          // Broadcast updated authoritative state to ALL connected clients (including sender for revision ACK)
          broadcastToAll({
            type: 'STATE_UPDATED',
            state: updated,
            senderId: msg.senderId,
          });
          return;
        }

        if (msg.type === 'SET_APP_TIME') {
          let newOffsetMs = authoritativeState.appTimeOffsetMs;
          if (msg.resetToRealTime) {
            newOffsetMs = 0;
          } else if (typeof msg.targetAppTimeMs === 'number' && Number.isFinite(msg.targetAppTimeMs)) {
            newOffsetMs = Math.round(msg.targetAppTimeMs - Date.now());
          } else if (typeof msg.appTimeOffsetMs === 'number' && Number.isFinite(msg.appTimeOffsetMs)) {
            newOffsetMs = Math.round(msg.appTimeOffsetMs);
          }

          const updated = applyAuthoritativeUpdate(
            { appTimeOffsetMs: newOffsetMs },
            msg.updatedBy || 'Admin Sekolah',
            msg.resetToRealTime ? 'RESET_WAKTU_REALTIME' : 'SINKRONISASI_WAKTU_APLIKASI'
          );

          broadcastToAll({
            type: 'STATE_UPDATED',
            state: updated,
            senderId: msg.senderId,
          });
          return;
        }
      } catch (err) {
        console.error('[E-Pilketos WS] Gagal memproses pesan WebSocket:', err);
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
      broadcastToAll({
        type: 'PRESENCE_UPDATE',
        appTimeOffsetMs: authoritativeState.appTimeOffsetMs,
        revision: authoritativeState.revision,
      });
    });

    (ws as unknown as { isAlive: boolean }).isAlive = true;
    ws.on('pong', () => {
      (ws as unknown as { isAlive: boolean }).isAlive = true;
    });

    ws.on('error', () => {
      clients.delete(ws);
    });
  });

  // Keepalive ping every 15s to keep connections alive through Cloud Run / proxy firewalls
  const keepAliveInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      const clientSock = ws as unknown as { isAlive: boolean };
      if (clientSock.isAlive === false) {
        clients.delete(ws);
        return ws.terminate();
      }
      clientSock.isAlive = false;
      try {
        ws.ping();
      } catch {
        clients.delete(ws);
      }
    });
  }, 15000);

  // Authoritative Time & Revision Heartbeat every 3 seconds so all clients stay locked to the exact same clock and revision
  const heartbeatInterval = setInterval(() => {
    if (clients.size > 0) {
      broadcastToAll({
        type: 'TIME_HEARTBEAT',
        appTimeOffsetMs: authoritativeState.appTimeOffsetMs,
        revision: authoritativeState.revision,
        serverTimeMs: Date.now(),
        updatedAt: authoritativeState.updatedAt,
        lastAction: authoritativeState.lastAction,
      });
    }
  }, 3000);

  httpServer.on('close', () => {
    clearInterval(heartbeatInterval);
    clearInterval(keepAliveInterval);
  });

  // --- REST API ENDPOINTS (For HTTP sync & fallback polling) ---
  app.get('/api/revision', (_req, res) => {
    res.json({
      revision: authoritativeState.revision,
      updatedAt: authoritativeState.updatedAt,
      updatedBy: authoritativeState.updatedBy,
      lastAction: authoritativeState.lastAction,
      appTimeOffsetMs: authoritativeState.appTimeOffsetMs,
      serverTimeMs: Date.now(),
      onlineClients: getOnlineCount(),
    });
  });

  app.get('/api/state', (_req, res) => {
    res.json({
      state: authoritativeState,
      serverTimeMs: Date.now(),
      onlineClients: getOnlineCount(),
    });
  });

  app.post('/api/state', (req, res) => {
    const { state, updatedBy, lastAction, senderId } = req.body || {};
    if (!state || typeof state !== 'object') {
      res.status(400).json({ error: 'Payload state tidak valid.' });
      return;
    }

    const updated = applyAuthoritativeUpdate(
      state,
      updatedBy || state.updatedBy || 'Admin Sekolah',
      lastAction || state.lastAction || 'HTTP_STATE_MUTATION'
    );

    broadcastToAll({
      type: 'STATE_UPDATED',
      state: updated,
      senderId,
    });

    res.json({
      success: true,
      state: updated,
      serverTimeMs: Date.now(),
      onlineClients: getOnlineCount(),
    });
  });

  app.get('/api/time', (_req, res) => {
    const serverTimeMs = Date.now();
    res.json({
      serverTimeMs,
      appTimeOffsetMs: authoritativeState.appTimeOffsetMs,
      appTimeMs: serverTimeMs + authoritativeState.appTimeOffsetMs,
      revision: authoritativeState.revision,
      onlineClients: getOnlineCount(),
    });
  });

  app.post('/api/time', (req, res) => {
    const { targetAppTimeMs, appTimeOffsetMs, resetToRealTime, updatedBy, senderId } = req.body || {};
    let newOffsetMs = authoritativeState.appTimeOffsetMs;

    if (resetToRealTime) {
      newOffsetMs = 0;
    } else if (typeof targetAppTimeMs === 'number' && Number.isFinite(targetAppTimeMs)) {
      newOffsetMs = Math.round(targetAppTimeMs - Date.now());
    } else if (typeof appTimeOffsetMs === 'number' && Number.isFinite(appTimeOffsetMs)) {
      newOffsetMs = Math.round(appTimeOffsetMs);
    }

    const updated = applyAuthoritativeUpdate(
      { appTimeOffsetMs: newOffsetMs },
      updatedBy || 'Admin Sekolah',
      resetToRealTime ? 'RESET_WAKTU_REALTIME' : 'SINKRONISASI_WAKTU_APLIKASI'
    );

    broadcastToAll({
      type: 'STATE_UPDATED',
      state: updated,
      senderId,
    });

    res.json({
      success: true,
      state: updated,
      serverTimeMs: Date.now(),
      onlineClients: getOnlineCount(),
    });
  });

  // Vite middleware in development, static files in production when dist exists
  const distPath = path.join(process.cwd(), 'dist');
  const hasDist = fs.existsSync(path.join(distPath, 'index.html'));

  if (process.env.NODE_ENV === 'production' && hasDist) {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[E-Pilketos Online Server] Berjalan di http://0.0.0.0:${PORT} (Real-Time WS & Unified Clock Aktif)`);
  });
}

startServer();
