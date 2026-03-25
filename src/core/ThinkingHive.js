import { ModelRouter, BrainRole } from '../llm/ModelRouter.js';
import { LanceManager } from '../memory/LanceManager.js';
export class ThinkingHive {
    modelRouter;
    memory;
    constructor(modelRouter, memory) {
        this.modelRouter = modelRouter;
        this.memory = memory;
    }
    async collaborate(goal, context) {
        console.log(`[ThinkingHive] 🧠 Initiating Neural Debate for: "${goal}"`);
        // 1. Check Memory for previous debates
        const pastDebates = await this.memory.search(`debate: ${goal}`, 1);
        if (pastDebates.length > 0 && pastDebates[0]) { // Check for undefined safe access
            const debate = pastDebates[0];
            // Simple similarity check (mocked) or just return if very relevant
            if (debate.text.includes(goal)) {
                console.log("[ThinkingHive] ⚡ Recall: Found previous solution.");
                return `(Recalled from Memory)\n${debate.text}`;
            }
        }
        // 2. The Architect (Propose)
        console.log("[ThinkingHive] 🏗️ Architect (Claude) is designing...");
        // Ideally switch model here if registry allows. Using 'CODER' role as proxy for 'Smart Logic' or default.
        const architectPrompt = `You are the Architect. Propose a high-level technical plan to achieve: "${goal}".\nContext: ${context}`;
        const proposal = await this.modelRouter.generateResponse(architectPrompt, context, BrainRole.THINKER);
        // 3. The Critic (Review)
        console.log("[ThinkingHive] 🧐 Critic (GPT-4o) is reviewing...");
        const criticPrompt = `You are the Critic. Review this proposal for security risks, bugs, and flaws:\n${proposal}\n\nBe harsh but constructive.`;
        const critique = await this.modelRouter.generateResponse(criticPrompt, context, BrainRole.CHAT);
        // 4. The Synthesizer (Finalize)
        console.log("[ThinkingHive] 🧪 Synthesizer (Gemini) is merging...");
        const synthPrompt = `You are the Synthesizer. Combine the Proposal and the Critique into a final, actionable Execution Plan.\n\nProposal:\n${proposal}\n\nCritique:\n${critique}`;
        const finalPlan = await this.modelRouter.generateResponse(synthPrompt, context, BrainRole.THINKER);
        // 5. Commit to Memory
        await this.memory.addMemory(finalPlan, {
            type: 'hive_debate',
            goal: goal,
            timestamp: new Date().toISOString()
        });
        return finalPlan;
    }
}
//# sourceMappingURL=ThinkingHive.js.map