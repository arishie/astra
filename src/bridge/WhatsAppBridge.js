import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import * as fs from 'fs/promises';
import * as path from 'path';
import { AbstractBridge, } from './BaseBridge.js';
export var WhatsAppMode;
(function (WhatsAppMode) {
    WhatsAppMode["BAILEYS"] = "baileys";
    WhatsAppMode["BUSINESS_API"] = "business";
})(WhatsAppMode || (WhatsAppMode = {}));
export class WhatsAppBridge extends AbstractBridge {
    platform = 'whatsapp';
    mode;
    sock;
    authDir;
    qrCode;
    reconnectAttempts = 0;
    maxReconnectAttempts = 5;
    businessToken;
    phoneNumberId;
    webhookVerifyToken;
    constructor(config) {
        super(config.userId);
        this.mode = config.mode || WhatsAppMode.BAILEYS;
        this.authDir = path.join('sessions', 'whatsapp', config.userId);
        if (config.credentials) {
            this.businessToken = config.credentials.businessToken;
            this.phoneNumberId = config.credentials.phoneNumberId;
            this.webhookVerifyToken = config.credentials.verifyToken;
        }
    }
    async start() {
        console.log(`[WhatsAppBridge] Starting in ${this.mode} mode for user ${this.userId}`);
        if (this.mode === WhatsAppMode.BAILEYS) {
            await this.startBaileys();
        }
        else {
            await this.startBusinessAPI();
        }
    }
    async stop() {
        console.log(`[WhatsAppBridge] Stopping bridge for user ${this.userId}`);
        if (this.sock) {
            this.sock.end(undefined);
            this.sock = undefined;
        }
        this.connected = false;
        this.clearError();
    }
    async sendMessage(to, content, options) {
        if (!this.connected) {
            throw new Error('WhatsApp bridge is not connected');
        }
        if (this.mode === WhatsAppMode.BAILEYS) {
            await this.sendBaileysMessage(to, content, options);
        }
        else {
            await this.sendBusinessMessage(to, content, options);
        }
        this.updateActivity();
    }
    getStatus() {
        return {
            ...super.getStatus(),
            mode: this.mode,
            qrCode: this.qrCode,
        };
    }
    getQRCode() {
        return this.qrCode;
    }
    handleWebhookVerification(mode, token, challenge) {
        if (this.mode !== WhatsAppMode.BUSINESS_API) {
            return null;
        }
        if (mode === 'subscribe' && token === this.webhookVerifyToken) {
            console.log('[WhatsAppBridge] Webhook verified successfully');
            return challenge;
        }
        console.warn('[WhatsAppBridge] Webhook verification failed');
        return null;
    }
    async handleWebhookMessage(payload) {
        if (this.mode !== WhatsAppMode.BUSINESS_API) {
            return;
        }
        try {
            for (const entry of payload.entry) {
                for (const change of entry.changes) {
                    if (change.field !== 'messages')
                        continue;
                    const value = change.value;
                    const messages = value.messages || [];
                    const contacts = value.contacts || [];
                    for (const msg of messages) {
                        const contact = contacts.find((c) => c.wa_id === msg.from);
                        let content = '';
                        if (msg.type === 'text' && msg.text) {
                            content = msg.text.body;
                        }
                        else if (msg.type === 'image' && msg.image) {
                            content = `[Image: ${msg.image.caption || 'No caption'}]`;
                        }
                        else if (msg.type === 'document' && msg.document) {
                            content = `[Document: ${msg.document.filename}]`;
                        }
                        if (content && this.messageHandler) {
                            const bridgeMessage = {
                                sender: msg.from,
                                senderName: contact?.profile.name,
                                content,
                                platform: 'whatsapp',
                                userId: this.userId,
                                timestamp: new Date(parseInt(msg.timestamp) * 1000),
                                metadata: {
                                    messageId: msg.id,
                                    type: msg.type,
                                    mode: 'business',
                                },
                            };
                            await this.messageHandler(bridgeMessage);
                        }
                    }
                }
            }
            this.updateActivity();
        }
        catch (error) {
            console.error('[WhatsAppBridge] Error processing webhook message:', error);
        }
    }
    async startBaileys() {
        try {
            await fs.mkdir(this.authDir, { recursive: true });
            const { state, saveCreds } = await useMultiFileAuthState(this.authDir);
            const { version } = await fetchLatestBaileysVersion();
            const sock = makeWASocket({
                version,
                logger: pino({ level: 'silent' }),
                printQRInTerminal: false,
                auth: state,
                browser: ['Astra AI', 'Chrome', '120.0.0'],
                connectTimeoutMs: 60000,
                defaultQueryTimeoutMs: undefined,
                keepAliveIntervalMs: 25000,
            });
            this.sock = sock;
            sock.ev.on('connection.update', async (update) => {
                await this.handleConnectionUpdate(update, saveCreds);
            });
            sock.ev.on('creds.update', saveCreds);
            sock.ev.on('messages.upsert', async (m) => {
                await this.handleBaileysMessages(m);
            });
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.setError(errorMessage);
            throw error;
        }
    }
    async handleConnectionUpdate(update, saveCreds) {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
            this.qrCode = qr;
            console.log(`[WhatsAppBridge] QR code available for user ${this.userId}`);
        }
        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            console.log(`[WhatsAppBridge] Connection closed for ${this.userId}, status: ${statusCode}, reconnecting: ${shouldReconnect}`);
            this.connected = false;
            this.qrCode = undefined;
            if (shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
                this.reconnectAttempts++;
                const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
                console.log(`[WhatsAppBridge] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
                setTimeout(() => {
                    this.startBaileys().catch(console.error);
                }, delay);
            }
            else if (statusCode === DisconnectReason.loggedOut) {
                await fs.rm(this.authDir, { recursive: true, force: true });
                this.setError('Logged out from WhatsApp');
            }
        }
        else if (connection === 'open') {
            console.log(`[WhatsAppBridge] Connected for user ${this.userId}`);
            this.connected = true;
            this.reconnectAttempts = 0;
            this.qrCode = undefined;
            this.clearError();
            this.updateActivity();
        }
    }
    async handleBaileysMessages(m) {
        if (m.type !== 'notify')
            return;
        for (const msg of m.messages) {
            if (msg.key.fromMe)
                continue;
            const sender = msg.key.remoteJid;
            if (!sender)
                continue;
            let content = '';
            let hasAttachment = false;
            let attachmentType;
            if (msg.message?.conversation) {
                content = msg.message.conversation;
            }
            else if (msg.message?.extendedTextMessage?.text) {
                content = msg.message.extendedTextMessage.text;
            }
            else if (msg.message?.imageMessage) {
                content = msg.message.imageMessage.caption || '[Image]';
                hasAttachment = true;
                attachmentType = 'image';
            }
            else if (msg.message?.videoMessage) {
                content = msg.message.videoMessage.caption || '[Video]';
                hasAttachment = true;
                attachmentType = 'video';
            }
            else if (msg.message?.audioMessage) {
                content = '[Audio message]';
                hasAttachment = true;
                attachmentType = 'audio';
            }
            else if (msg.message?.documentMessage) {
                content = `[Document: ${msg.message.documentMessage.fileName || 'file'}]`;
                hasAttachment = true;
                attachmentType = 'document';
            }
            if (!content)
                continue;
            const pushName = msg.pushName || undefined;
            if (this.messageHandler) {
                const bridgeMessage = {
                    sender,
                    senderName: pushName,
                    content,
                    platform: 'whatsapp',
                    userId: this.userId,
                    hasAttachment,
                    attachmentType,
                    timestamp: new Date(parseInt(msg.messageTimestamp?.toString() || '0') * 1000),
                    metadata: {
                        messageId: msg.key.id,
                        mode: 'baileys',
                    },
                };
                console.log(`[WhatsAppBridge] Received from ${sender}: ${content.substring(0, 50)}...`);
                await this.messageHandler(bridgeMessage);
            }
        }
        this.updateActivity();
    }
    async sendBaileysMessage(to, content, options) {
        if (!this.sock) {
            throw new Error('Socket not initialized');
        }
        const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
        if (options?.replyTo) {
            await this.sock.sendMessage(jid, { text: content }, { quoted: { key: { id: options.replyTo } } });
        }
        else {
            await this.sock.sendMessage(jid, { text: content });
        }
        console.log(`[WhatsAppBridge] Sent message to ${to}`);
    }
    async startBusinessAPI() {
        if (!this.businessToken || !this.phoneNumberId) {
            throw new Error('Business API requires businessToken and phoneNumberId');
        }
        const testResult = await this.testBusinessAPIConnection();
        if (!testResult.success) {
            throw new Error(`Business API connection failed: ${testResult.error}`);
        }
        this.connected = true;
        this.clearError();
        this.updateActivity();
        console.log(`[WhatsAppBridge] Business API ready for user ${this.userId}`);
    }
    async testBusinessAPIConnection() {
        try {
            const response = await fetch(`https://graph.facebook.com/v18.0/${this.phoneNumberId}`, {
                headers: {
                    Authorization: `Bearer ${this.businessToken}`,
                },
            });
            if (!response.ok) {
                const error = await response.json();
                return { success: false, error: error.error?.message || 'API request failed' };
            }
            return { success: true };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Connection failed',
            };
        }
    }
    async sendBusinessMessage(to, content, options) {
        if (!this.businessToken || !this.phoneNumberId) {
            throw new Error('Business API not configured');
        }
        const phoneNumber = to.replace(/[^0-9]/g, '');
        const messagePayload = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: phoneNumber,
            type: 'text',
            text: { body: content },
        };
        if (options?.replyTo) {
            messagePayload.context = { message_id: options.replyTo };
        }
        const response = await fetch(`https://graph.facebook.com/v18.0/${this.phoneNumberId}/messages`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${this.businessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(messagePayload),
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Failed to send message: ${error.error?.message || 'Unknown error'}`);
        }
        console.log(`[WhatsAppBridge] Business API sent message to ${to}`);
    }
    async persistSession() {
        if (this.mode !== WhatsAppMode.BAILEYS) {
            return null;
        }
        try {
            const credsPath = path.join(this.authDir, 'creds.json');
            const credsData = await fs.readFile(credsPath, 'utf-8');
            return JSON.parse(credsData);
        }
        catch {
            return null;
        }
    }
    async restoreSession(sessionData) {
        if (this.mode !== WhatsAppMode.BAILEYS) {
            return;
        }
        try {
            await fs.mkdir(this.authDir, { recursive: true });
            const credsPath = path.join(this.authDir, 'creds.json');
            await fs.writeFile(credsPath, JSON.stringify(sessionData, null, 2));
            console.log(`[WhatsAppBridge] Session restored for user ${this.userId}`);
        }
        catch (error) {
            console.error('[WhatsAppBridge] Failed to restore session:', error);
        }
    }
}
export function createWhatsAppBridgeFactory() {
    return async (config) => {
        const bridge = new WhatsAppBridge(config);
        return bridge;
    };
}
//# sourceMappingURL=WhatsAppBridge.js.map