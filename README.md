# MIGRA LXC - Proxmox Migration Tool

Strumento web per la migrazione di container LXC tra host Proxmox indipendenti usando uno storage NAS/Ponte.

## Funzionalità
- ✨ **Interfaccia Premium**: Design moderno con Glassmorphism.
- 🚀 **Real-time Logs**: Visualizzazione avanzamento tramite WebSocket.
- 💾 **Storage Bridge**: Usa un NAS condiviso (NFS/CIFS) per il passaggio dei file.
- ✅ **Validazione**: Controllo conflitti ID su host destinazione.
- 🛡️ **Sicurezza**: Cleanup manuale post-migrazione per prevenire perdite dati in caso di errori.

## Installazione su Ubuntu LXC

1. **Installa Node.js**:
   ```bash
   apt update && apt install -y nodejs npm
   ```

2. **Clona e prepara**:
   ```bash
   mkdir -p /migra && cd /migra
   # (Copia i file del progetto qui)
   npm install
   ```

3. **Configurazione**:
   - I dati degli host sono salvati in `config/hosts.json` (creato al primo avvio).
   - Accedi alla web app alla porta `8080` per configurare gli host Proxmox (Nome, IP, root@pam, password).

4. **Avvio**:
   ```bash
   # Terminale 1 (Backend)
   node backend/index.js
   
   # Terminale 2 (Frontend)
   node backend/frontend-server.js
   ```

## Prerequisiti Proxmox
- Permessi API abilitati (root@pam consigliato o utente con PVEAdmin).
- Storage condiviso (NAS) visibile ad entrambi gli host Proxmox con lo stesso nome storage.
- Lo storage destinazione deve essere di tipo compatibile con LXC (ZFS, LVM, etc.).

## Troubleshooting
- **Errore SSL**: Il tool ignora gli errori SSL dei certificati self-signed di Proxmox.
- **Porte**: Assicurati che le porte 3001 (API/WS) e 8080 (WEB) siano aperte.
- **Timeout**: Migrazioni di grandi dimensioni potrebbero richiedere diversi minuti; controlla i log real-time.

---
*Sviluppato con Antigravity per la gestione efficiente dell'infrastruttura Proxmox.*
