import axios from 'axios';
import https from 'https';

export class ProxmoxClient {
    constructor(host, user, password, apiToken = null) {
        this.host = host;
        this.user = user;
        this.password = password;
        this.apiToken = apiToken; // Format: "TOKENID=SECRET"
        this.ticket = null;
        this.csrfToken = null;
        this.axios = axios.create({
            baseURL: `https://${host}:8006/api2/json`,
            httpsAgent: new https.Agent({ rejectUnauthorized: false }),
        });
    }

    async authenticate() {
        try {
            if (this.apiToken) {
                // API Token Authentication
                // Header: Authorization: PVEAPIToken=USER@REALM!TOKENID=SECRET
                this.axios.defaults.headers.common['Authorization'] = `PVEAPIToken=${this.user}!${this.apiToken}`;
                return true;
            } else {
                // Ticket Authentication (Password)
                const response = await this.axios.post('/access/ticket', {
                    username: this.user,
                    password: this.password,
                });
                this.ticket = response.data.data.ticket;
                this.csrfToken = response.data.data.CSRFPreventionToken;
                this.axios.defaults.headers.common['Cookie'] = `PVEAuthCookie=${this.ticket}`;
                this.axios.defaults.headers.common['CSRFPreventionToken'] = this.csrfToken;
                return true;
            }
        } catch (error) {
            console.error(`Authentication failed for ${this.host}:`, error.message);
            throw error;
        }
    }

    async getNodes() {
        const response = await this.axios.get('/nodes');
        return response.data.data;
    }

    async getLXC(node) {
        const response = await this.axios.get(`/nodes/${node}/lxc`);
        return response.data.data;
    }

    async getLXCConfig(node, vmid) {
        const response = await this.axios.get(`/nodes/${node}/lxc/${vmid}/config`);
        return response.data.data;
    }

    async stopLXC(node, vmid) {
        const response = await this.axios.post(`/nodes/${node}/lxc/${vmid}/status/stop`);
        return response.data.data;
    }

    async startLXC(node, vmid) {
        const response = await this.axios.post(`/nodes/${node}/lxc/${vmid}/status/start`);
        return response.data.data;
    }

    async backupLXC(node, vmid, storage, notes = '') {
        const response = await this.axios.post(`/nodes/${node}/vzdump`, {
            vmid,
            storage,
            mode: 'stop',
            compress: 'zstd',
            remove: 0,
            'notes-template': notes,
        });
        return response.data.data; // task UPID
    }

    async restoreLXC(node, vmid, storage, archive) {
        const response = await this.axios.post(`/nodes/${node}/lxc`, {
            vmid,
            storage,
            ostemplate: archive,
            force: 1,
            restore: 1,
        });
        return response.data.data; // task UPID
    }

    async getTaskStatus(node, upid) {
        const response = await this.axios.get(`/nodes/${node}/tasks/${upid}/status`);
        return response.data.data;
    }

    async getTaskLog(node, upid) {
        const response = await this.axios.get(`/nodes/${node}/tasks/${upid}/log`);
        return response.data.data;
    }

    async deleteLXC(node, vmid) {
        const response = await this.axios.delete(`/nodes/${node}/lxc/${vmid}`);
        return response.data.data;
    }

    async deleteBackup(node, storage, volid) {
        const response = await this.axios.delete(`/nodes/${node}/storage/${storage}/content/${volid}`);
        return response.data.data;
    }

    async getStorage(node) {
        const response = await this.axios.get(`/nodes/${node}/storage`);
        return response.data.data;
    }

    async getStorageContent(node, storage) {
        const response = await this.axios.get(`/nodes/${node}/storage/${storage}/content`);
        return response.data.data;
    }
    
    async checkVmidExists(vmid) {
        const nodes = await this.getNodes();
        for (const node of nodes) {
            const lxcs = await this.getLXC(node.node);
            if (lxcs.find(l => l.vmid == vmid)) return true;
            // Also check VMs if needed, but requirements say LXC migrator
            const vms = await this.axios.get(`/nodes/${node.node}/qemu`);
            if (vms.data.data.find(v => v.vmid == vmid)) return true;
        }
        return false;
    }
}
