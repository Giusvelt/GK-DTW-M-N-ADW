# 🛰️ MISSION CONTROL: GeoKanban V3

Questo è il cuore della memoria del progetto. Ogni agente (AI o umano) DEVE leggere questo file prima di iniziare qualsiasi attività.

## 🎯 Obiettivo Finale (The North Star)
Trasformare GeoKanban da un semplice software di tracciamento a uno strumento di **Business Intelligence e Automazione Totale** per la gestione delle flotte marittime. L'app deve essere rigorosa nella sicurezza (permessi diversificati), infallibile nel tracciamento (poligoni PostGIS) e fluida nell'uso (Mobile per Crew, Desktop per Admin).

## 🏗️ Architettura & Standard
- **Database**: Supabase (PostgreSQL + PostGIS).
- **Logica Geografica**: Esclusivamente **Poligonale** (`ST_Intersects`/`ST_Contains`). Il raggio (radius) è vietato per decisioni operative.
- **Frontend**: React + Tailwind. Design "Kinetic Compact" (denso, premium, senza spazi vuoti).
- **Ruoli**: 
    - `crew`: Mobile (Logbook + News), Desktop (Sola Mappa).
    - `operation_admin`: Controllo totale, KPI, DB Manager.

## 📜 Protocollo di Ingaggio (Handover)
Prima di iniziare, ogni agente deve:
1.  Leggere questo file (`MISSION_CONTROL.md`).
2.  Analizzare il `DEVELOPER_LOG.md` per evitare errori passati.
3.  Controllare `task.md` per le priorità correnti.
4.  Controllare `BACKLOG.md` per i task posticipati.

## 🚦 Stato Attuale
- [x] Blindatura Desktop Crew (Mappa Only).
- [x] News & ADV Mobile per Crew.
- [/] **CRITICO**: Ripristino logica Poligonale nel Database (In corso).
- [ ] Rifacimento UX Mobile Crew (Sessione Full-Screen).

---
*Ultimo Aggiornamento: 23 Mar 2026*
