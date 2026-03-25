import { Gateway, AuthLevel } from '../gateway/Gateway.js';
import { CapabilityManager } from '../capabilities/CapabilityManager.js';
import { Heartbeat } from '../heartbeat/Heartbeat.js';
import { WhatsAppBridge } from '../bridge/WhatsAppBridge.js';
import { TelegramBridge } from '../bridge/TelegramBridge.js';
import { DiscordBridge } from '../bridge/DiscordBridge.js';
import { SlackBridge } from '../bridge/SlackBridge.js';
import { type BaseBridge, type BridgeMessage } from '../bridge/BaseBridge.js';
import { MemoryManager } from '../memory/MemoryManager.js';
import { LanceManager } from '../memory/LanceManager.js';
import { IngestionWorker } from '../workers/IngestionWorker.js';
import { ModelRouter, BrainRole } from '../llm/ModelRouter.js';
import { ToolSynthesizer } from './ToolSynthesizer.js';
import { Sentinel } from '../modules/Sentinel.js';
import { WebOperative } from '../modules/WebOperative.js';
import { ShadowLab } from '../modules/ShadowLab.js';
import { VisualAgent } from '../workers/VisualAgent.js';
import { ThinkingHive } from './ThinkingHive.js';
import { MidjourneyWorker } from '../workers/MidjourneyWorker.js';

export class AstraOrchestrator {
    private gateway: Gateway;
    private capabilities: CapabilityManager;
    private bridges: BaseBridge[] = [];
    private heartbeat: Heartbeat;
    private memory: LanceManager;
    private ingestion: IngestionWorker;
    private modelRouter: ModelRouter;
    private toolSynthesizer: ToolSynthesizer;
    private visualAgent: VisualAgent;
    private thinkingHive: ThinkingHive;
    private mjWorker: MidjourneyWorker;

    // New Modules
    private sentinel: Sentinel;
    private webOperative: WebOperative;
    private shadowLab: ShadowLab;

    // Authenticated users: Map<platform:senderId, userId>
    private authenticatedUsers: Map<string, string> = new Map();

    // State for pending visual actions per user
    private pendingVisualActions: Map<string, any> = new Map();

    // System token for internal operations
    private systemToken: string | null = null;

    constructor() {
        // 1. Initialize Security Gateway
        this.gateway = new Gateway();

        // 2. Initialize Capabilities (requires proper authentication for operations)
        this.capabilities = new CapabilityManager(this.gateway);

        // 3. Initialize Bridges (deprecated - use MultiTenantOrchestrator instead)
        // These are created with a system userId for backward compatibility
        const systemUserId = 'system';

        const waBridge = new WhatsAppBridge({
            userId: systemUserId,
            platform: 'whatsapp',
            credentials: {},
        });
        this.bridges.push(waBridge);

        const tgBridge = new TelegramBridge({
            userId: systemUserId,
            platform: 'telegram',
            credentials: { token: process.env.TELEGRAM_TOKEN || '' },
        });
        this.bridges.push(tgBridge);

        const dcBridge = new DiscordBridge({
            userId: systemUserId,
            platform: 'discord',
            credentials: { token: process.env.DISCORD_TOKEN || '' },
        });
        this.bridges.push(dcBridge);

        const slackBridge = new SlackBridge({
            userId: systemUserId,
            platform: 'slack',
            credentials: {
                token: process.env.SLACK_TOKEN || '',
                signingSecret: process.env.SLACK_SIGNING_SECRET || '',
                appToken: process.env.SLACK_APP_TOKEN || '',
            },
        });
        this.bridges.push(slackBridge);


        // 4. Initialize Memory & Ingestion
        this.memory = new LanceManager();
        this.ingestion = new IngestionWorker(this.memory);

        // 5. Initialize LLM Layer
        this.modelRouter = new ModelRouter();
        this.thinkingHive = new ThinkingHive(this.modelRouter, this.memory);

        // 6. Initialize Tool Synthesizer & Visual
        this.toolSynthesizer = new ToolSynthesizer(this.modelRouter, this.capabilities);
        this.visualAgent = new VisualAgent(this.modelRouter, this.capabilities, this.memory);

        // 7. Initialize Advanced Modules
        this.sentinel = new Sentinel(waBridge); 
        this.webOperative = new WebOperative();
        this.shadowLab = new ShadowLab();
        this.mjWorker = new MidjourneyWorker(dcBridge, this.memory);

        // 8. Initialize Heartbeat (broadcasts to authenticated users only)
        this.heartbeat = new Heartbeat(async (msg) => {
            // Only send heartbeat to first authenticated user (admin) if any
            // In production, this should be configurable
            console.log(`[Heartbeat] ${msg}`);
        });
    }

    /**
     * Initialize system token for internal operations.
     * Must be called after construction with proper environment configuration.
     */
    public async initializeSystemAuth(): Promise<boolean> {
        try {
            const systemSecret = process.env.SYSTEM_SECRET;
            if (!systemSecret) {
                console.error('[Orchestrator] SYSTEM_SECRET not configured. System operations will be limited.');
                return false;
            }

            const tokens = await this.gateway.generateSystemToken('orchestrator');
            this.systemToken = tokens.accessToken;
            console.log('[Orchestrator] System authentication initialized.');
            return true;
        } catch (error) {
            console.error('[Orchestrator] Failed to initialize system auth:', error);
            return false;
        }
    }

    /**
     * Link a platform sender to an authenticated user.
     * This should be called after user authenticates via web/API and links their platform.
     */
    public linkPlatformUser(platform: string, platformSenderId: string, userId: string): void {
        const key = `${platform}:${platformSenderId}`;
        this.authenticatedUsers.set(key, userId);
        console.log(`[Orchestrator] Linked ${platform} user ${platformSenderId} to user ${userId}`);
    }

    /**
     * Check if a platform sender is linked to an authenticated user.
     */
    public getLinkedUserId(platform: string, platformSenderId: string): string | null {
        const key = `${platform}:${platformSenderId}`;
        return this.authenticatedUsers.get(key) || null;
    }

    private getBridgeByPlatform(platform: string): BaseBridge | undefined {
        if (platform === 'whatsapp') return this.bridges[0];
        if (platform === 'telegram') return this.bridges[1];
        if (platform === 'discord') return this.bridges[2];
        if (platform === 'slack') return this.bridges[3];
        return undefined;
    }

    public async start() {
        console.log("[Orchestrator] Starting Astra...");

        // Initialize system authentication
        const authInitialized = await this.initializeSystemAuth();
        if (!authInitialized) {
            console.warn("[Orchestrator] ⚠️ Running without system authentication. Some features will be limited.");
        }

        // Start modules
        await this.memory.initialize();
        this.ingestion.start();
        this.sentinel.start();

        // Start All Bridges
        for (const bridge of this.bridges) {
            bridge.setMessageHandler(async (msg: BridgeMessage) => {
                await this.handleIncomingMessage(msg);
            });
            await bridge.start();
        }

        this.heartbeat.start();
        
        console.log("[Orchestrator] Astra is Online on all channels.");
    }

    private async handleIncomingMessage(msg: BridgeMessage) {
        const { sender, content, platform } = msg;
        const bridge = this.getBridgeByPlatform(platform);
        if (!bridge) return;

        // SECURITY: Check if this platform user is linked to an authenticated user
        const userId = this.getLinkedUserId(platform, sender);

        if (!userId) {
            // User not authenticated - provide instructions
            await bridge.sendMessage(
                sender,
                "⚠️ Authentication Required\n\n" +
                "Please authenticate via the Astra web portal first, then link your " +
                `${platform} account to use Astra.\n\n` +
                "Visit: https://astra.ai/connect"
            );
            console.log(`[Orchestrator] Unauthenticated message from ${platform}:${sender}`);
            return;
        }

        const trimmedMsg = content.trim();
        const userKey = `${platform}:${sender}`;

        try {
            if (trimmedMsg.startsWith('/hive')) {
                const goal = trimmedMsg.substring(6).trim();
                await bridge.sendMessage(sender, "🧠 Summoning the Thinking Hive...");
                const plan = await this.thinkingHive.collaborate(goal, "User Request");
                await bridge.sendMessage(sender, `🛑 **Hive Decision:**\n${plan}`);

            } else if (trimmedMsg.startsWith('/imagine')) {
                const prompt = trimmedMsg.substring(9).trim();
                await bridge.sendMessage(sender, "🎨 Sending to Creative Studio (Midjourney)...");
                if (platform === 'discord') {
                    const status = await this.mjWorker.generate(prompt, sender);
                    await bridge.sendMessage(sender, status);
                } else {
                    await bridge.sendMessage(sender, "⚠️ Midjourney only available via Discord bridge currently.");
                }

            } else if (trimmedMsg.startsWith('/visual')) {
                const goal = trimmedMsg.substring(7).trim();
                if (!goal) {
                    await bridge.sendMessage(sender, "Usage: /visual [goal]");
                    return;
                }
                await bridge.sendMessage(sender, "👁️ Visual Agent: Analyzing screen...");
                const plan = await this.visualAgent.analyze(goal);
                // Store pending action per user for security
                this.pendingVisualActions.set(userKey, plan);
                await bridge.sendMessage(sender, `⚠️ **Visual Action Proposed:**\n${plan.description}\n\nReply '/confirm' to execute.`);

            } else if (trimmedMsg === '/confirm') {
                const pendingAction = this.pendingVisualActions.get(userKey);
                if (pendingAction) {
                    await bridge.sendMessage(sender, "✅ Executing Visual Action...");
                    await this.visualAgent.performAction(pendingAction);
                    this.pendingVisualActions.delete(userKey);
                    await bridge.sendMessage(sender, "Done.");
                } else {
                    await bridge.sendMessage(sender, "No pending action.");
                }

            } else if (trimmedMsg.startsWith('/browse')) {
                const url = trimmedMsg.substring(8).trim();
                if (!url) {
                    await bridge.sendMessage(sender, "Usage: /browse [url]");
                    return;
                }
                await bridge.sendMessage(sender, "🕵️ Web Operative Deployed...");
                const content = await this.webOperative.fetchContent(url);
                await bridge.sendMessage(sender, `📄 Page Content (Snippet):\n${content.substring(0, 500)}...`);

            } else if (trimmedMsg.startsWith('/verify')) {
                await bridge.sendMessage(sender, "🧪 Shadow Lab: Verifying code safety...");
                const result = await this.shadowLab.verifyCode('print("Hello from Sandbox")', 'python');
                await bridge.sendMessage(sender, result.success ? `✅ Safe. Output: ${result.output}` : `❌ Failed. Output: ${result.output}`);

            } else if (trimmedMsg.startsWith('/add_brain')) {
                // /add_brain [NAME] [PROVIDER] [KEY] (Simple registration)
                const parts = trimmedMsg.split(' ');
                if (parts.length < 4) {
                    await bridge.sendMessage(sender, "Usage: /add_brain [name] [provider] [key]");
                    return;
                }
                const name = parts[1]!;
                const providerType = parts[2] as any;
                const apiKey = parts[3]!;
                
                // Defaulting modelId same as name or generic, user can edit later
                const modelId = name; 

                this.modelRouter.getRegistry().registerModel({
                    name, providerType, modelId, apiKey, tier: 2 // Default to Standard tier
                });
                await bridge.sendMessage(sender, `🧠 Added Brain: ${name}. You can switch to it now.`);

            } else if (trimmedMsg.startsWith('/brain_stats')) {
                const models = this.modelRouter.getRegistry().listModels();
                let stats = "📊 **Brain Stats:**\n";
                for(const m of models) {
                    const cfg = this.modelRouter.getRegistry().getConfig(m);
                    stats += `- **${m}**: Tier ${cfg?.tier || 1} (${cfg?.providerType})\n`;
                }
                await bridge.sendMessage(sender, stats);

            } else if (trimmedMsg.startsWith('/register_model')) {
                const parts = trimmedMsg.split(' ');
                if (parts.length < 5) {
                    await bridge.sendMessage(sender, "Usage: /register_model [name] [provider] [model_id] [api_key] [base_url?]");
                    return;
                }
                const name = parts[1]!;
                const providerType = parts[2] as 'openai' | 'anthropic' | 'google' | 'openai-compatible';
                const modelId = parts[3]!;
                const apiKey = parts[4]!;
                const baseUrl = parts[5]; 

                const config: any = { name, providerType, modelId, apiKey };
                if (baseUrl) config.baseUrl = baseUrl;

                this.modelRouter.getRegistry().registerModel(config);
                await bridge.sendMessage(sender, `✅ Registered model '${name}'. You can now use: /switch ${name}`);

            } else if (trimmedMsg.startsWith('/switch')) {
                 const parts = trimmedMsg.split(' ');
                const modelName = parts[1];
                
                if (!modelName) {
                    const available = this.modelRouter.getRegistry().listModels().join(", ");
                    await bridge.sendMessage(sender, `Available Models: ${available}\nUsage: /switch [model_name]`);
                    return;
                }
                try {
                    this.modelRouter.setActiveModel(modelName);
                    await bridge.sendMessage(sender, `🧠 Brain switched to: ${modelName}`);
                } catch (e: any) {
                    await bridge.sendMessage(sender, `❌ Error: ${e.message}`);
                }

            } else if (trimmedMsg.startsWith('/auto_tool')) {
                const goal = trimmedMsg.substring(10).trim();
                if (!goal) {
                    await bridge.sendMessage(sender, "Usage: /auto_tool [description of task]");
                    return;
                }

                if (!this.systemToken) {
                    await bridge.sendMessage(sender, "⚠️ System not fully initialized. Please try again later.");
                    return;
                }

                await bridge.sendMessage(sender, `🛠️ Thinking about how to build a tool for: "${goal}"...`);

                try {
                    const result = await this.toolSynthesizer.synthesize(goal, this.systemToken);
                    await bridge.sendMessage(sender, `✅ Evolution Complete:\n${result}`);
                } catch (e: any) {
                    await bridge.sendMessage(sender, `❌ Evolution Failed: ${e.message}`);
                }

            } else if (trimmedMsg.startsWith('/set_key')) {
                const parts = trimmedMsg.split(' ');
                const provider = parts[1];
                const key = parts[2];

                if (!provider || !key) {
                    await bridge.sendMessage(sender, "Usage: /set_key [provider] [key]");
                    return;
                }
                await bridge.sendMessage(sender, "⚠️ Please use /register_model to set keys and configs.");


            } else if (trimmedMsg.startsWith('/')) {
                const command = trimmedMsg.substring(1); 
                await this.executeCommandRequest(sender, command, bridge);

            } else {
                await this.processQuery(sender, trimmedMsg, bridge);
            }
        } catch (error: any) {
            console.error(`[Orchestrator] Error processing message: ${error}`);
            await bridge.sendMessage(sender, `⚠️ Error: ${error.message}`);
        }
    }

    private async executeCommandRequest(sender: string, command: string, bridge: BaseBridge) {
        console.log(`[Orchestrator] Received command request: ${command}`);

        if (!this.systemToken) {
            await bridge.sendMessage(sender, "⚠️ System not fully initialized. Command execution unavailable.");
            return;
        }

        try {
            const result = await this.capabilities.executeCommand(command, this.systemToken);
            await bridge.sendMessage(sender, `✅ Output:\n${result}`);
        } catch (e: any) {
            await bridge.sendMessage(sender, `⛔ Authorization/Execution Failed: ${e.message}`);
        }
    }

    private async processQuery(sender: string, query: string, bridge: BaseBridge) {
        console.log(`[Orchestrator] Processing query: ${query}`);
        
        // Check if this is a heavy-duty task requiring the Python Engine
        if (query.startsWith("/plan") || query.startsWith("/solve")) {
             await bridge.sendMessage(sender, "⚙️ Rerouting to Neural Engine (Python/LangGraph)...");
             try {
                 const engineResponse = await this.callEngine(query);
                 await bridge.sendMessage(sender, `🧠 Engine Response:\n${engineResponse}`);
                 return;
             } catch (e: any) {
                 await bridge.sendMessage(sender, `❌ Engine Failure: ${e.message}. Falling back to standard brain.`);
             }
        }

        // 1. Search Memory (Hybrid RAG via LanceDB)
        const results = await this.memory.search(query, 3);
        const context = results.length > 0 ? results.map(r => r.text).join("\n\n") : "No relevant local documents found.";
        
        // 2. Generate Response using Active Model
        try {
            const response = await this.modelRouter.generateResponse(query, context);
            await bridge.sendMessage(sender, response);
        } catch (e: any) {
             await bridge.sendMessage(sender, `🧠 Brain Freeze (LLM Error): ${e.message}`);
        }
    }

    private async callEngine(query: string): Promise<string> {
        // Native fetch (Node 18+)
        try {
            const response = await fetch("http://localhost:8000/process", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query: query })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP Error ${response.status}`);
            }
            
            const data = await response.json() as any;
            return data.response;
        } catch (e: any) {
            throw new Error(`Connection to Python Engine failed: ${e.message}`);
        }
    }
}