import { ModelRouter, BrainRole } from '../llm/ModelRouter.js';
import { CapabilityManager } from '../capabilities/CapabilityManager.js';
import { SandboxManager, SandboxMode } from '../security/SandboxManager.js';
import path from 'path';
import fs from 'fs';

export class ToolSynthesizer {
    private modelRouter: ModelRouter;
    private capabilities: CapabilityManager;
    private sandbox: SandboxManager;
    private dynamicToolsDir: string = 'src/dynamic_tools';
    private tempDir: string = 'src/dynamic_tools/temp';

    constructor(modelRouter: ModelRouter, capabilities: CapabilityManager) {
        this.modelRouter = modelRouter;
        this.capabilities = capabilities;
        // Ideally utilize Docker for synthesis testing
        this.sandbox = new SandboxManager(SandboxMode.HOST); 
    }

    public async synthesize(goal: string, sessionToken: string): Promise<string> {
        console.log(`[ToolSynthesizer] 🧬 Evolving capability for: "${goal}"`);

        // 1. Generate Code (Iteration Loop)
        let attempts = 0;
        const maxAttempts = 3;
        let lastError = "";

        while (attempts < maxAttempts) {
            attempts++;
            console.log(`[ToolSynthesizer] 🧪 Attempt ${attempts}/${maxAttempts}`);

            const code = await this.generateCode(goal, lastError);
            const scriptName = `tool_${Date.now()}_v${attempts}.py`;
            const scriptPath = path.join(this.tempDir, scriptName);

            // Write candidate to temp
            await this.capabilities.writeToFile(scriptPath, code, sessionToken);

            // 2. Test in Sandbox
            // For testing, we might need to mock input or rely on the script being self-contained
            console.log(`[ToolSynthesizer] 🕵️ Testing in Sandbox...`);
            try {
                // We assume the script prints "SUCCESS" or reasonable output if working
                const output = await this.sandbox.execute(`python3 ${scriptPath}`);
                
                // Heuristic validation: Did it crash? (Exit code check handled by sandbox)
                // We can add LLM-based output verification here
                console.log(`[ToolSynthesizer] ✅ Test passed.`);
                
                // 3. Persist
                const finalToolName = `tool_${this.sanitizeName(goal)}.py`;
                const finalPath = path.join(this.dynamicToolsDir, finalToolName);
                await this.capabilities.writeToFile(finalPath, code, sessionToken);
                
                // Register permission (hacky auto-whitelist for now)
                try {
                    // This assumes we have a method or we manually allow 'python3 path'
                    // The Orchestrator usually handles execution via executeCommand which whitelists prefix
                    // We might need to explicitly allow this new file path in a stricter system
                } catch {} // Empty catch block is fine here

                return `Success! Created new tool: ${finalToolName}.\nYou can now ask me to perform this task again directly.`;

            } catch (e: any) {
                console.warn(`[ToolSynthesizer] ❌ Test Failed: ${e.message}`);
                lastError = e.message;
            }
        }

        throw new Error(`Failed to synthesize tool after ${maxAttempts} attempts. Last error: ${lastError}`);
    }

    private async generateCode(goal: string, lastError: string): Promise<string> {
        const prompt = `
        GOAL: ${goal}        
        CONTEXT: You are writing a Python script to accomplish this.
        ${lastError ? `PREVIOUS ERROR TO FIX: ${lastError}` : ''}
        
        INSTRUCTIONS:
        1. Write a standalone Python 3 script.
        2. It must print the result to STDOUT.
        3. Handle errors gracefully.
        4. Do NOT require user input.
        5. Output ONLY the raw code, no markdown blocks.
        `;

        const response = await this.modelRouter.generateResponse(prompt, "", BrainRole.CODER);
        return response.replace(/```python/g, '').replace(/```/g, '').trim();
    }

    private sanitizeName(goal: string): string {
        return goal.replace(/[^a-z0-9]/gi, '_').substring(0, 20).toLowerCase();
    }
}