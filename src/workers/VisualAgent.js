import screenshot from 'screenshot-desktop';
import robot from 'robotjs';
import fs from 'fs';
import path from 'path';
import { ModelRouter, BrainRole } from '../llm/ModelRouter.js';
import { CapabilityManager } from '../capabilities/CapabilityManager.js';
import { LanceManager } from '../memory/LanceManager.js';
export class VisualAgent {
    modelRouter;
    capabilities;
    memory;
    screenshotsDir = 'screenshots';
    constructor(modelRouter, capabilities, memory) {
        this.modelRouter = modelRouter;
        this.capabilities = capabilities;
        this.memory = memory;
        if (!fs.existsSync(this.screenshotsDir)) {
            fs.mkdirSync(this.screenshotsDir);
        }
    }
    async captureScreen() {
        const filename = `screen_${Date.now()}.png`;
        const filepath = path.join(this.screenshotsDir, filename);
        try {
            await screenshot({ filename: filepath });
            console.log(`[VisualAgent] Screenshot captured: ${filepath}`);
            return filepath;
        }
        catch (e) {
            throw new Error(`Failed to capture screen: ${e.message}`);
        }
    }
    async analyze(goal) {
        console.log(`[VisualAgent] 👁️ Analyzing screen for goal: "${goal}"`);
        // 1. Check Visual Memory
        const memories = await this.memory.search(goal, 1);
        if (memories.length > 0 && memories[0]) {
            const mem = memories[0];
            const meta = mem.metadata;
            if (meta.type === 'visual_memory') { // Ensure metadata type matches
                console.log(`[VisualAgent] 🧠 Visual Recall: Found UI element from memory.`);
                return {
                    type: 'click', // Simplified assumption
                    x: meta.x,
                    y: meta.y,
                    description: `(Memory) Click ${goal} at [${meta.x}, ${meta.y}]`
                };
            }
        }
        // 2. Capture
        const imagePath = await this.captureScreen();
        console.log(`[VisualAgent] Sending ${imagePath} to Vision Model...`);
        // SIMULATED RESPONSE
        const simulatedX = 500;
        const simulatedY = 450;
        const action = {
            type: 'click',
            x: simulatedX,
            y: simulatedY,
            description: `Click the target at [${simulatedX}, ${simulatedY}]`
        };
        return action;
    }
    async performAction(action) {
        console.log(`[VisualAgent] Performing: ${action.description}`);
        switch (action.type) {
            case 'move':
                if (action.x !== undefined && action.y !== undefined) {
                    robot.moveMouse(action.x, action.y);
                }
                break;
            case 'click':
                if (action.x !== undefined && action.y !== undefined) {
                    robot.moveMouse(action.x, action.y);
                    robot.mouseClick();
                    // Save to Memory
                    if (this.memory) {
                        await this.memory.addMemory(`Visual Element Location: [${action.x}, ${action.y}]`, {
                            type: 'visual_memory',
                            x: action.x,
                            y: action.y,
                            action: 'click'
                        });
                    }
                }
                break;
            case 'type':
                if (action.text) {
                    robot.typeString(action.text);
                }
                break;
            default:
                console.warn(`[VisualAgent] Unknown action type: ${action.type}`);
        }
    }
}
//# sourceMappingURL=VisualAgent.js.map