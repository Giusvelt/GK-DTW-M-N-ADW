---
description: Procedura per aggiornare il file task.md in caso di nuove richieste o interruzioni lungo la linea
---

Questo workflow serve a garantire che il file `task.md` rimanga sempre allineato con gli obiettivi concordati con l'utente, specialmente quando emergono nuove priorità o interruzioni nel flusso di lavoro.

1. **Analisi della richiesta**: Identifica se la nuova informazione è un obiettivo immediato (Fase 1) o un miglioramento futuro (Fase 2).
2. **Aggiornamento Task**: Usa lo strumento `multi_replace_file_content` per inserire i nuovi punti nel file `task.md`.
3. **Mantenimento Storico**: Sposta i task completati nella sezione "Task Precedenti" per mantenere pulita la lista attiva.
4. **Sincronizzazione Boundary**: Dopo ogni aggiornamento del file, chiama immediatamente `task_boundary` per riflettere lo stato aggiornato nell'interfaccia utente.
