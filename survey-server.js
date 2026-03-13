const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { spawn } = require('child_process');
const os = require('os');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const PORT = 4000;
const isPublic = process.argv.includes('--public');
let publicUrl = null;

// Serve static files
app.use(express.static(path.join(__dirname)));

// In-memory vote storage
const votes = {
  q1: { ja: 0, nein: 0 },
  q2: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0 },
  q3: { 'gar-nicht': 0, weniger: 0, 'gleich-viel': 0, mehr: 0 },
};
let totalVoters = 0;
const voterIds = new Set();

// Pizza survey storage
const pizzaVotes = {
  anzahl: 0,
  sorten: {
    'margherita': 0, 'salami': 0, 'prosciutto': 0, 'tonno': 0,
    'mista': 0, 'rucola': 0, 'hawaii': 0, 'gyros': 0,
    'broccoli': 0, 'peperoni': 0, 'quattro-formaggi': 0,
  },
};
let pizzaVoters = 0;
const pizzaVoterIds = new Set();

// REST API
app.get('/api/info', (_req, res) => {
  if (publicUrl) {
    res.json({ voteUrl: `${publicUrl}?vote`, pizzaUrl: `${publicUrl}?pizza`, ip: publicUrl, port: PORT, mode: 'public' });
  } else {
    const ip = getLocalIP();
    res.json({ voteUrl: `http://${ip}:${PORT}?vote`, pizzaUrl: `http://${ip}:${PORT}?pizza`, ip, port: PORT, mode: 'local' });
  }
});

app.get('/api/results', (_req, res) => {
  res.json({ votes, totalVoters });
});

app.get('/api/pizza/results', (_req, res) => {
  res.json({ pizzaVotes, pizzaVoters });
});

app.post('/api/pizza/reset', (_req, res) => {
  pizzaVotes.anzahl = 0;
  Object.keys(pizzaVotes.sorten).forEach(k => pizzaVotes.sorten[k] = 0);
  pizzaVoters = 0;
  pizzaVoterIds.clear();
  io.emit('pizza-results', { pizzaVotes, pizzaVoters });
  res.json({ ok: true });
});

app.post('/api/reset', (_req, res) => {
  votes.q1 = { ja: 0, nein: 0 };
  votes.q2 = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0 };
  votes.q3 = { 'gar-nicht': 0, weniger: 0, 'gleich-viel': 0, mehr: 0 };
  totalVoters = 0;
  voterIds.clear();
  io.emit('results', { votes, totalVoters });
  res.json({ ok: true });
});

// WebSocket
io.on('connection', (socket) => {
  console.log(`Client verbunden: ${socket.id}`);
  socket.emit('results', { votes, totalVoters });
  socket.emit('pizza-results', { pizzaVotes, pizzaVoters });

  socket.on('vote', (data) => {
    const { voterId, q1, q2, q3 } = data;

    // Prevent duplicate votes
    if (voterIds.has(voterId)) {
      socket.emit('already-voted');
      return;
    }
    voterIds.add(voterId);
    totalVoters++;

    if (q1 && votes.q1[q1] !== undefined) votes.q1[q1]++;
    if (q2 && votes.q2[q2] !== undefined) votes.q2[q2]++;
    if (q3 && votes.q3[q3] !== undefined) votes.q3[q3]++;

    io.emit('results', { votes, totalVoters });
    socket.emit('vote-accepted');
    console.log(`Vote von ${voterId} | Teilnehmer: ${totalVoters}`);
  });

  socket.on('pizza-vote', (data) => {
    const { voterId, anzahl, sorten } = data;
    if (pizzaVoterIds.has(voterId)) {
      socket.emit('pizza-already-voted');
      return;
    }
    pizzaVoterIds.add(voterId);
    pizzaVoters++;
    if (anzahl && Number(anzahl) > 0) pizzaVotes.anzahl += Number(anzahl);
    if (Array.isArray(sorten)) {
      sorten.forEach(s => { if (pizzaVotes.sorten[s] !== undefined) pizzaVotes.sorten[s]++; });
    }
    io.emit('pizza-results', { pizzaVotes, pizzaVoters });
    socket.emit('pizza-vote-accepted');
    console.log(`Pizza-Vote von ${voterId} | Teilnehmer: ${pizzaVoters}`);
  });

  socket.on('disconnect', () => {
    console.log(`Client getrennt: ${socket.id}`);
  });
});

// Get local IP for QR code
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const iface of Object.values(interfaces)) {
    for (const alias of iface) {
      if (alias.family === 'IPv4' && !alias.internal) return alias.address;
    }
  }
  return 'localhost';
}

// Start Cloudflare Tunnel for public access
function startTunnel() {
  return new Promise((resolve) => {
    const cf = spawn('cloudflared', ['tunnel', '--url', `http://localhost:${PORT}`], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let resolved = false;

    const handleOutput = (data) => {
      const output = data.toString();
      // cloudflared gibt die URL auf stderr aus
      const match = output.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (match && !resolved) {
        resolved = true;
        publicUrl = match[0];

        console.log('');
        console.log('╔══════════════════════════════════════════════════════════╗');
        console.log('║  PUBLIC MODE – Teilnehmer brauchen kein lokales WLAN!   ║');
        console.log('╠══════════════════════════════════════════════════════════╣');
        console.log(`║  Öffentliche URL: ${publicUrl}`);
        console.log(`║  Umfrage:         ${publicUrl}?vote`);
        console.log('╠══════════════════════════════════════════════════════════╣');
        console.log('║  Cloudflare Tunnel – verschlüsselt & sicher             ║');
        console.log('║  Teilnehmer können von überall teilnehmen.              ║');
        console.log('╚══════════════════════════════════════════════════════════╝');
        console.log('');
        resolve();
      }
    };

    cf.stdout.on('data', handleOutput);
    cf.stderr.on('data', handleOutput);

    cf.on('error', (err) => {
      if (!resolved) {
        resolved = true;
        if (err.code === 'ENOENT') {
          console.error('cloudflared nicht gefunden. Bitte installieren:');
          console.error('  brew install cloudflared');
        } else {
          console.error('Tunnel-Fehler:', err.message);
        }
        console.log('Fallback: Lokaler Modus (gleiches WLAN nötig)');
        resolve();
      }
    });

    cf.on('close', (code) => {
      if (code !== 0 && !resolved) {
        resolved = true;
        console.error('cloudflared wurde unerwartet beendet.');
        console.log('Fallback: Lokaler Modus (gleiches WLAN nötig)');
        resolve();
      }
      publicUrl = null;
    });

    // Timeout nach 15 Sekunden
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        console.error('Tunnel-Timeout: cloudflared hat nicht rechtzeitig geantwortet.');
        console.log('Fallback: Lokaler Modus (gleiches WLAN nötig)');
        resolve();
      }
    }, 15000);

    // Cleanup bei Prozessende
    process.on('SIGINT', () => { cf.kill(); process.exit(); });
    process.on('SIGTERM', () => { cf.kill(); process.exit(); });
  });
}

server.listen(PORT, '0.0.0.0', async () => {
  const ip = getLocalIP();
  console.log('');
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  KI-Unterstützung in der Softwareentwicklung        ║');
  console.log('║  Präsentation & Live-Umfrage                        ║');
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log(`║  Präsentation: http://${ip}:${PORT}                  ║`);
  console.log(`║  Umfrage:      http://${ip}:${PORT}?vote             ║`);
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log('║  Teilnehmer scannen den QR-Code in der Präsentation ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log('');

  if (isPublic) {
    await startTunnel();
  } else {
    console.log('Tipp: Für netzunabhängigen Zugriff starte mit:');
    console.log('  npm run public');
    console.log('');
  }
});
