# KI-Unterstützung in der Softwareentwicklung

**Meetup-Datum:** 13. März 2026

## Inhalt

Interaktive Präsentation mit Live-Umfragen zum Thema KI-gestützte Softwareentwicklung.

### Themen

1. **Evolution** - Von Texteditoren zu KI-Agent-Teams
2. **Vibe-Coder vs. Agentic Engineer** - Was wir wirklich tun
3. **MI trifft KI** - Warum sich menschliche und künstliche Entwickler ähnlicher sind als gedacht
4. **Was wir bei lenne.Tech nutzen** - Claude Code, Plugins, TDD, Prozesse
5. **Ausblick** - Automatische Ticket-Bearbeitung, KI-Reviews, Memory
6. **Takeaways** - Was man mitnehmen sollte

### Features

- Live-Umfrage via QR-Code (KI-Nutzung)
- Pizza-Umfrage via QR-Code
- Dark/Light-Mode
- Responsive Design
- Echtzeit-Ergebnisse via WebSocket

## Starten

```bash
npm install
npm start
```

Die Präsentation ist dann unter `http://<lokale-ip>:4000` erreichbar.

### Public Mode (ohne lokales WLAN)

```bash
# Voraussetzung: brew install cloudflared
npm run public
```

Erstellt einen Cloudflare-Tunnel, sodass Teilnehmer von überall teilnehmen können.

## Technologien

- HTML/CSS/JS (Single-Page)
- Node.js + Express + Socket.IO
- Cloudflare Tunnel (cloudflared)
