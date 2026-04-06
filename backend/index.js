import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import fs from 'fs';
import path from 'path';
import { ProxmoxClient } from './proxmox.js';

const app = express();
const port = process.env.PORT || 3001;
const CONFIG_PATH = path.join(process.cwd(), 'config', 'hosts.json');

app.use(cors());
app.use(express.json());

// Ensure config file exists
if (!fs.existsSync(CONFIG_PATH)) {
    fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
    fs.writeFileSync(CONFIG_PATH, JSON.stringify([]));
}

// Helpers
const getHosts = () => JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
const saveHosts = (hosts) => fs.writeFileSync(CONFIG_PATH, JSON.stringify(hosts, null, 2));

// API Routes
app.get('/api/hosts', (req, res) => {
    const hosts = getHosts();
    res.json(hosts.map(h => ({ name: h.name, host: h.host, user: h.user })));
});

app.post('/api/hosts', (req, res) => {
    const { name, host, user, password, apiToken } = req.body;
    const hosts = getHosts();
    if (hosts.find(h => h.name === name)) return res.status(400).json({ error: 'Name already exists' });
    hosts.push({ name, host, user, password, apiToken });
    saveHosts(hosts);
    res.status(201).json({ name, host, user });
});

app.get('/api/hosts/:name', (req, res) => {
    const hosts = getHosts();
    const host = hosts.find(h => h.name === req.params.name);
    if (!host) return res.status(404).send('Host not found');
    res.json(host); // Return all including password
});

app.put('/api/hosts/:name', (req, res) => {
    const { host, user, password, apiToken } = req.body;
    let hosts = getHosts();
    const index = hosts.findIndex(h => h.name === req.params.name);
    if (index === -1) return res.status(404).send('Host not found');
    
    hosts[index] = { ...hosts[index], host, user, password, apiToken };
    saveHosts(hosts);
    res.json({ name: req.params.name, host, user });
});

app.delete('/api/hosts/:name', (req, res) => {
    let hosts = getHosts();
    const initialLength = hosts.length;
    hosts = hosts.filter(h => h.name !== req.params.name);
    if (hosts.length === initialLength) return res.status(404).send('Host not found');
    saveHosts(hosts);
    res.status(204).send();
});

app.post('/api/hosts/test', async (req, res) => {
    const { host, user, password, apiToken } = req.body;
    try {
        const client = new ProxmoxClient(host, user, password, apiToken);
        await client.authenticate();
        const nodes = await client.getNodes();
        res.json({ success: true, message: `Connected! Cluster has ${nodes.length} nodes.` });
    } catch (e) {
        res.status(401).json({ success: false, message: e.message });
    }
});

app.get('/api/proxmox/:hostname/lxcs', async (req, res) => {
    try {
        const hosts = getHosts();
        const host = hosts.find(h => h.name === req.params.hostname);
        if (!host) return res.status(404).send('Host not found');
        const client = new ProxmoxClient(host.host, host.user, host.password, host.apiToken);
        await client.authenticate();
        const nodes = await client.getNodes();
        let allLxcs = [];
        for (const node of nodes) {
            const lxcs = await client.getLXC(node.node);
            allLxcs = allLxcs.concat(lxcs.map(l => ({ ...l, node: node.node })));
        }
        res.json(allLxcs);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/proxmox/:hostname/nodes', async (req, res) => {
    try {
        const hosts = getHosts();
        const host = hosts.find(h => h.name === req.params.hostname);
        if (!host) return res.status(404).send('Host not found');
        const client = new ProxmoxClient(host.host, host.user, host.password, host.apiToken);
        await client.authenticate();
        const nodes = await client.getNodes();
        res.json(nodes);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/proxmox/:hostname/storage', async (req, res) => {
    try {
        const hosts = getHosts();
        const host = hosts.find(h => h.name === req.params.hostname);
        if (!host) return res.status(404).send('Host not found');
        const client = new ProxmoxClient(host.host, host.user, host.password, host.apiToken);
        await client.authenticate();
        
        const nodeFilter = req.query.node;
        const nodes = await client.getNodes();
        let allStorage = [];
        
        for (const node of nodes) {
            if (nodeFilter && node.node !== nodeFilter) continue;
            const storage = await client.getStorage(node.node);
            allStorage = allStorage.concat(storage.map(s => ({ ...s, node: node.node })));
        }
        res.json(allStorage);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/proxmox/:hostname/check-vmid/:vmid', async (req, res) => {
    try {
        const hosts = getHosts();
        const host = hosts.find(h => h.name === req.params.hostname);
        if (!host) return res.status(404).send('Host not found');
        const client = new ProxmoxClient(host.host, host.user, host.password, host.apiToken);
        await client.authenticate();
        const exists = await client.checkVmidExists(req.params.vmid);
        res.json({ exists });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/proxmox/:hostname/next-vmid', async (req, res) => {
    try {
        const hosts = getHosts();
        const host = hosts.find(h => h.name === req.params.hostname);
        if (!host) return res.status(404).send('Host not found');
        const client = new ProxmoxClient(host.host, host.user, host.password, host.apiToken);
        await client.authenticate();
        const nodes = await client.getNodes();
        const usedIds = new Set();
        for (const node of nodes) {
            const lxcs = await client.getLXC(node.node);
            lxcs.forEach(l => usedIds.add(Number(l.vmid)));
            try {
                const vms = await client.axios.get(`/nodes/${node.node}/qemu`);
                vms.data.data.forEach(v => usedIds.add(Number(v.vmid)));
            } catch (_) {}
        }
        let nextId = 100;
        while (usedIds.has(nextId)) nextId++;
        res.json({ vmid: nextId });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

const server = app.listen(port, () => {
    console.log(`Backend running on port ${port}`);
});

// WebSocket for Migration Logs
const wss = new WebSocketServer({ server });
let migrationInProgress = false;
let lastMigrationInfo = null;

wss.on('connection', (ws) => {
    console.log('Client connected');
    
    ws.on('message', async (message) => {
        const data = JSON.parse(message);
        if (data.type === 'START_MIGRATION') {
            if (migrationInProgress) {
                ws.send(JSON.stringify({ type: 'ERROR', message: 'Migration already in progress' }));
                return;
            }
            migrationInProgress = true;
            try {
                lastMigrationInfo = await performMigration(data.payload, (log) => {
                    ws.send(JSON.stringify({ type: 'LOG', payload: log }));
                });
                migrationInProgress = false;
            } catch (e) {
                ws.send(JSON.stringify({ type: 'ERROR', message: e.message }));
                migrationInProgress = false;
            }
        }

        if (data.type === 'CONFIRM_CLEANUP') {
            if (!lastMigrationInfo) {
                ws.send(JSON.stringify({ type: 'ERROR', message: 'No migration info found for cleanup' }));
                return;
            }
            try {
                await performCleanup(lastMigrationInfo, (log) => {
                    ws.send(JSON.stringify({ type: 'LOG', payload: log }));
                });
                lastMigrationInfo = null;
                ws.send(JSON.stringify({ type: 'LOG', payload: 'Cleanup completed successfully.' }));
            } catch (e) {
                ws.send(JSON.stringify({ type: 'ERROR', message: `Cleanup failed: ${e.message}` }));
            }
        }
    });
});

async function performMigration(params, log) {
    const { sourceHostName, destHostName, destNode, vmid, destVmid, destStorage, bridgeStorage } = params;
    
    log(`Starting migration of LXC ${vmid} from ${sourceHostName} to ${destHostName}`);
    
    const hosts = getHosts();
    const source = hosts.find(h => h.name === sourceHostName);
    const dest = hosts.find(h => h.name === destHostName);
    
    const sClient = new ProxmoxClient(source.host, source.user, source.password, source.apiToken);
    const dClient = new ProxmoxClient(dest.host, dest.user, dest.password, dest.apiToken);
    
    await sClient.authenticate();
    await dClient.authenticate();
    
    // Find node of LXC
    const sNodes = await sClient.getNodes();
    let sNode;
    for (const n of sNodes) {
        const lxcs = await sClient.getLXC(n.node);
        if (lxcs.find(l => l.vmid == vmid)) {
            sNode = n.node;
            break;
        }
    }
    
    if (!sNode) throw new Error('Source node not found');
    
    // 1. Stop if running
    const lxcList = await sClient.getLXC(sNode);
    const lxcInfo = lxcList.find(l => l.vmid == vmid);
    const lxcName = lxcInfo.name || `LXC-${vmid}`;
    
    if (lxcInfo.status === 'running') {
        log(`Stopping LXC ${vmid} (${lxcName})...`);
        const stopTask = await sClient.stopLXC(sNode, vmid);
        await waitForTask(sClient, sNode, log, stopTask);
        
        // Wait until status is actually 'stopped'
        log(`Waiting for LXC ${vmid} to reach stopped state...`);
        let currentStatus = 'running';
        let retries = 0;
        while (currentStatus !== 'stopped' && retries < 15) {
            const lxcs = await sClient.getLXC(sNode);
            currentStatus = lxcs.find(l => l.vmid == vmid).status;
            if (currentStatus !== 'stopped') {
                await new Promise(r => setTimeout(r, 2000));
                retries++;
            }
        }
        if (currentStatus !== 'stopped') throw new Error(`LXC ${vmid} failed to stop in time`);
        log(`LXC ${vmid} is now stopped.`);
    }
    
    // 2. Backup to Bridge Storage
    log(`Backing up LXC ${vmid} (${lxcName}) to bridge storage ${bridgeStorage}...`);
    let backupTask;
    try {
        backupTask = await sClient.backupLXC(sNode, vmid, bridgeStorage, lxcName);
    } catch (e) {
        if (e.response && e.response.status === 400) {
            const pveError = e.response.data.errors ? JSON.stringify(e.response.data.errors) : (e.response.data.message || 'Check storage permissions');
            log(`ERROR: Proxmox rejected backup (400): ${pveError}`);
            log(`Retrying without notes-template...`);
            backupTask = await sClient.backupLXC(sNode, vmid, bridgeStorage);
        } else {
            throw e;
        }
    }
    await waitForTask(sClient, sNode, log, backupTask);
    
    // Find the archive filename
    const contents = await sClient.getStorageContent(sNode, bridgeStorage);
    // Usually the most recent one for this VMID
    const backups = contents
        .filter(c => c.vmid == vmid && (c.content === 'backup' || c.volid.includes('vzdump-lxc')))
        .sort((a, b) => b.ctime - a.ctime);
    
    if (backups.length === 0) throw new Error('Backup file not found in bridge storage');
    const archive = backups[0].volid;
    log(`Backup created: ${archive}`);

    const dNode = destNode;

    // 3. Restore to Destination
    log(`Restoring LXC to ${destHostName} (Node: ${dNode}) as VMID ${destVmid} on storage ${destStorage}...`);
    let restoreTask;
    try {
        restoreTask = await dClient.restoreLXC(dNode, destVmid, destStorage, archive);
    } catch (e) {
        const pveError = e.response && e.response.data && e.response.data.errors ? JSON.stringify(e.response.data.errors) : (e.response && e.response.data && e.response.data.message ? e.response.data.message : e.message);
        log(`ERROR: Proxmox rejected restore (400): ${pveError}`);
        throw new Error(`Restore rejected by destination Proxmox: ${pveError}`);
    }
    await waitForTask(dClient, dNode, log, restoreTask);
    
    // 4. Start
    log(`Starting LXC ${destVmid} on destination...`);
    await dClient.startLXC(dNode, destVmid);
    
    // 5. Verify
    log(`Migration complete. Waiting for verification...`);
    // Basic ping test could be added here if IP is known
    
    const migrationInfo = {
        sourceHostName,
        sourceNode: sNode,
        vmid,
        bridgeStorage,
        archive,
        destHostName,
        destNode: dNode,
        destVmid
    };

    log(`VERIFY_REQUIRED: Migration successful. Confirm cleanup of source and bridge backup?`);
    return migrationInfo;
}

async function performCleanup(info, log) {
    const { sourceHostName, sourceNode, vmid, bridgeStorage, archive } = info;
    log(`Starting cleanup...`);
    
    const hosts = getHosts();
    const source = hosts.find(h => h.name === sourceHostName);
    const sClient = new ProxmoxClient(source.host, source.user, source.password, source.apiToken);
    await sClient.authenticate();

    log(`Deleting source LXC ${vmid} from ${sourceHostName}...`);
    await sClient.deleteLXC(sourceNode, vmid);
    
    log(`Deleting backup archive ${archive} from bridge storage ${bridgeStorage}...`);
    await sClient.deleteBackup(sourceNode, bridgeStorage, archive);

    log(`Cleanup finished.`);
}

async function waitForTask(client, node, log, upid) {
    if (!upid) return;
    let lastLine = 0;
    return new Promise((resolve, reject) => {
        const check = async () => {
            try {
                const status = await client.getTaskStatus(node, upid);
                // Try to get logs for progress
                const taskLogs = await client.getTaskLog(node, upid);
                for (let i = lastLine; i < taskLogs.length; i++) {
                    const line = taskLogs[i].t;
                    // Proxmox task logs often contain progress like (42%)
                    const match = line.match(/\((\d+)%\)/);
                    if (match) {
                        log(`PROGRESS:${match[1]}`);
                    }
                }
                lastLine = taskLogs.length;

                if (status.status === 'stopped') {
                    if (status.exitstatus === 'OK') {
                        resolve();
                    } else {
                        reject(new Error(`Task failed: ${status.exitstatus}`));
                    }
                } else {
                    setTimeout(check, 2000);
                }
            } catch (e) {
                reject(e);
            }
        };
        check();
    });
}
