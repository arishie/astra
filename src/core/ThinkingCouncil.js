// @ts-nocheck
import { generateText } from 'ai';
import { ModelRouter, BrainRole } from '../llm/ModelRouter.js';
import { ModelRegistry } from '../llm/ModelRegistry.js';
import { UniversalAdapter } from '../llm/UniversalAdapter.js';
import { LanceManager } from '../memory/LanceManager.js';
// ============================================================================
// Argument Evaluator
// ============================================================================
/**
 * Evaluates the strength of arguments using multiple criteria
 */
export class ArgumentEvaluator {
    modelRouter;
    constructor(modelRouter) {
        this.modelRouter = modelRouter;
    }
    /**
     * Score an argument based on multiple criteria
     */
    async evaluateArgument(argument, context) {
        const criteria = [
            this.evaluateLogicalCoherence(argument),
            this.evaluateEvidenceSupport(argument),
            this.evaluatePracticalFeasibility(argument),
            this.evaluateNovelty(argument, context),
            this.evaluateCompleteness(argument),
        ];
        const scores = await Promise.all(criteria);
        const weights = [0.25, 0.20, 0.25, 0.15, 0.15];
        return scores.reduce((sum, score, i) => sum + score * weights[i], 0);
    }
    evaluateLogicalCoherence(argument) {
        // Heuristic evaluation of logical structure
        const content = argument.content.toLowerCase();
        let score = 0.5;
        // Check for logical connectors
        const logicalConnectors = ['because', 'therefore', 'however', 'consequently', 'thus', 'hence'];
        const connectorsFound = logicalConnectors.filter((c) => content.includes(c)).length;
        score += Math.min(connectorsFound * 0.1, 0.3);
        // Check for structured reasoning
        if (content.includes('first') || content.includes('second') || content.includes('finally')) {
            score += 0.1;
        }
        // Penalize circular reasoning indicators
        if (content.match(/because it is|since it's true/)) {
            score -= 0.2;
        }
        return Math.max(0, Math.min(1, score));
    }
    evaluateEvidenceSupport(argument) {
        const content = argument.content.toLowerCase();
        let score = 0.4;
        // Check for evidence indicators
        const evidenceIndicators = [
            'according to',
            'research shows',
            'data indicates',
            'example',
            'case study',
            'empirically',
            'studies suggest',
            'evidence',
        ];
        const indicatorsFound = evidenceIndicators.filter((i) => content.includes(i)).length;
        score += Math.min(indicatorsFound * 0.15, 0.4);
        // Check for specific numbers/metrics
        if (content.match(/\d+%|\d+x|measured|quantified/)) {
            score += 0.1;
        }
        return Math.max(0, Math.min(1, score));
    }
    evaluatePracticalFeasibility(argument) {
        const content = argument.content.toLowerCase();
        let score = 0.5;
        // Positive indicators
        const practicalIndicators = [
            'implement',
            'deploy',
            'scalable',
            'maintainable',
            'cost-effective',
            'realistic',
            'achievable',
        ];
        const positiveFound = practicalIndicators.filter((i) => content.includes(i)).length;
        score += Math.min(positiveFound * 0.1, 0.3);
        // Check for consideration of constraints
        if (content.includes('constraint') || content.includes('limitation') || content.includes('trade-off')) {
            score += 0.15;
        }
        return Math.max(0, Math.min(1, score));
    }
    evaluateNovelty(argument, context) {
        const content = argument.content.toLowerCase();
        const contextLower = context.toLowerCase();
        let score = 0.5;
        // Check for innovative language
        const noveltyIndicators = ['novel', 'innovative', 'unique', 'alternative', 'unconventional', 'creative'];
        const indicatorsFound = noveltyIndicators.filter((i) => content.includes(i)).length;
        score += Math.min(indicatorsFound * 0.15, 0.3);
        // Check if argument introduces concepts not in context
        const contentWords = new Set(content.split(/\s+/).filter((w) => w.length > 5));
        const contextWords = new Set(contextLower.split(/\s+/).filter((w) => w.length > 5));
        const newConcepts = [...contentWords].filter((w) => !contextWords.has(w)).length;
        score += Math.min(newConcepts * 0.02, 0.2);
        return Math.max(0, Math.min(1, score));
    }
    evaluateCompleteness(argument) {
        const content = argument.content;
        let score = 0.5;
        // Length-based heuristic (not too short, not too verbose)
        const wordCount = content.split(/\s+/).length;
        if (wordCount >= 50 && wordCount <= 300) {
            score += 0.2;
        }
        else if (wordCount >= 30 && wordCount <= 500) {
            score += 0.1;
        }
        // Check for addressing multiple aspects
        const aspectIndicators = [
            'additionally',
            'furthermore',
            'moreover',
            'also',
            'another consideration',
            'on the other hand',
        ];
        const aspectsFound = aspectIndicators.filter((i) => content.toLowerCase().includes(i)).length;
        score += Math.min(aspectsFound * 0.1, 0.3);
        return Math.max(0, Math.min(1, score));
    }
    /**
     * Compare two arguments and determine which is stronger
     */
    async compareArguments(arg1, arg2, context) {
        const [score1, score2] = await Promise.all([
            this.evaluateArgument(arg1, context),
            this.evaluateArgument(arg2, context),
        ]);
        if (Math.abs(score1 - score2) < 0.1) {
            return 'equivalent';
        }
        return score1 > score2 ? arg1.id : arg2.id;
    }
}
// ============================================================================
// Debate Engine
// ============================================================================
/**
 * Manages rounds of debate between council members
 */
export class DebateEngine {
    modelRouter;
    registry;
    argumentEvaluator;
    argumentCounter = 0;
    constructor(modelRouter) {
        this.modelRouter = modelRouter;
        this.registry = modelRouter.getRegistry();
        this.argumentEvaluator = new ArgumentEvaluator(modelRouter);
    }
    /**
     * Conduct a full debate session
     */
    async conductDebate(question, options, members, config) {
        const rounds = [];
        let positions = new Map();
        // Initial position taking
        console.log('[DebateEngine] Opening statements phase...');
        const initialPositions = await this.getInitialPositions(question, options, members);
        initialPositions.forEach((pos) => positions.set(pos.memberId, pos));
        // Debate rounds
        for (let roundNum = 1; roundNum <= config.maxDebateRounds; roundNum++) {
            console.log(`[DebateEngine] Debate round ${roundNum}/${config.maxDebateRounds}`);
            const round = await this.conductRound(roundNum, question, positions, members, config);
            rounds.push(round);
            // Update positions based on arguments and critiques
            for (const update of round.positionUpdates) {
                positions.set(update.memberId, update);
            }
            // Check for early consensus
            const consensusLevel = this.calculateConsensusLevel(positions);
            if (consensusLevel >= config.minConsensusThreshold) {
                console.log(`[DebateEngine] Early consensus reached at ${(consensusLevel * 100).toFixed(1)}%`);
                break;
            }
        }
        return rounds;
    }
    /**
     * Get initial positions from all members
     */
    async getInitialPositions(question, options, members) {
        const positionPromises = members.map((member) => this.getMemberPosition(member, question, options, []));
        return Promise.all(positionPromises);
    }
    /**
     * Get a position from a specific member
     */
    async getMemberPosition(member, question, options, previousArguments) {
        const config = this.registry.getConfig(member.name);
        if (!config) {
            // Return a default position if model not available
            return {
                memberId: member.id,
                stance: options[0] || 'Unable to form position',
                reasoning: 'Model configuration not available',
                confidence: 0.3,
                supportingEvidence: [],
                potentialWeaknesses: ['Configuration missing'],
                timestamp: new Date(),
            };
        }
        const personalityPrompt = this.buildPersonalityPrompt(member.personality);
        const expertisePrompt = `You have expertise in: ${member.expertise.join(', ')}.`;
        const previousContext = previousArguments.length > 0
            ? `\nPrevious arguments in this debate:\n${previousArguments.map((a) => `- ${a.content}`).join('\n')}`
            : '';
        const prompt = `${personalityPrompt}
${expertisePrompt}

You are participating in a council deliberation. Form your position on the following question:

QUESTION: ${question}

${options.length > 0 ? `OPTIONS TO CONSIDER:\n${options.map((o, i) => `${i + 1}. ${o}`).join('\n')}` : ''}
${previousContext}

Provide your position in the following JSON format:
{
    "stance": "Your clear position statement",
    "reasoning": "Your detailed reasoning",
    "confidence": 0.0 to 1.0,
    "supportingEvidence": ["evidence1", "evidence2"],
    "potentialWeaknesses": ["weakness1", "weakness2"]
}`;
        try {
            const model = UniversalAdapter.createModel(config);
            const { text } = await generateText({
                model,
                prompt,
                maxTokens: 1000,
            });
            const parsed = this.parsePositionResponse(text, member.id);
            return parsed;
        }
        catch (error) {
            console.warn(`[DebateEngine] Failed to get position from ${member.name}: ${error.message}`);
            return {
                memberId: member.id,
                stance: 'Unable to form position due to error',
                reasoning: error.message,
                confidence: 0.1,
                supportingEvidence: [],
                potentialWeaknesses: ['API error'],
                timestamp: new Date(),
            };
        }
    }
    parsePositionResponse(text, memberId) {
        try {
            // Extract JSON from response
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return {
                    memberId,
                    stance: parsed.stance || 'Position unclear',
                    reasoning: parsed.reasoning || '',
                    confidence: Math.max(0, Math.min(1, parsed.confidence || 0.5)),
                    supportingEvidence: parsed.supportingEvidence || [],
                    potentialWeaknesses: parsed.potentialWeaknesses || [],
                    timestamp: new Date(),
                };
            }
        }
        catch {
            // Fall through to default
        }
        return {
            memberId,
            stance: text.substring(0, 200),
            reasoning: text,
            confidence: 0.5,
            supportingEvidence: [],
            potentialWeaknesses: [],
            timestamp: new Date(),
        };
    }
    /**
     * Conduct a single debate round
     */
    async conductRound(roundNumber, question, currentPositions, members, config) {
        const arguments_ = [];
        const critiques = [];
        const positionUpdates = [];
        // Each member can make arguments
        for (const member of members) {
            const position = currentPositions.get(member.id);
            if (!position)
                continue;
            // Generate supporting argument
            const supportArg = await this.generateArgument(member, question, position, 'support', roundNumber, []);
            if (supportArg) {
                supportArg.strength = await this.argumentEvaluator.evaluateArgument(supportArg, question);
                arguments_.push(supportArg);
            }
            // Generate counter-arguments to others
            for (const [otherId, otherPosition] of currentPositions) {
                if (otherId === member.id)
                    continue;
                const counterArg = await this.generateArgument(member, question, position, 'counter', roundNumber, [], otherPosition);
                if (counterArg) {
                    counterArg.strength = await this.argumentEvaluator.evaluateArgument(counterArg, question);
                    arguments_.push(counterArg);
                }
            }
        }
        // Generate critiques
        for (const member of members) {
            for (const argument of arguments_) {
                if (argument.memberId === member.id)
                    continue;
                const critique = await this.generateCritique(member, argument, question);
                if (critique) {
                    critiques.push(critique);
                }
            }
        }
        // Update positions based on debate
        for (const member of members) {
            const relevantCritiques = critiques.filter((c) => c.targetMemberId === member.id);
            const relevantCounters = arguments_.filter((a) => a.type === 'counter' && a.targetArgumentId && currentPositions.get(a.memberId));
            if (relevantCritiques.length > 0 || relevantCounters.length > 0) {
                const updatedPosition = await this.updatePosition(member, currentPositions.get(member.id), relevantCritiques, relevantCounters, question);
                positionUpdates.push(updatedPosition);
            }
        }
        return {
            roundNumber,
            arguments: arguments_,
            critiques,
            positionUpdates,
        };
    }
    async generateArgument(member, question, position, type, round, context, targetPosition) {
        const config = this.registry.getConfig(member.name);
        if (!config)
            return null;
        let prompt = '';
        if (type === 'support') {
            prompt = `You are ${member.name} with expertise in ${member.expertise.join(', ')}.

In debate round ${round}, provide a supporting argument for your position.

QUESTION: ${question}
YOUR POSITION: ${position.stance}
YOUR REASONING: ${position.reasoning}

Provide a strong argument (2-3 paragraphs) supporting your position. Focus on evidence and logical reasoning.`;
        }
        else if (type === 'counter' && targetPosition) {
            prompt = `You are ${member.name} with expertise in ${member.expertise.join(', ')}.

In debate round ${round}, provide a counter-argument to another position.

QUESTION: ${question}
YOUR POSITION: ${position.stance}
OPPOSING POSITION: ${targetPosition.stance}
THEIR REASONING: ${targetPosition.reasoning}

Provide a respectful but strong counter-argument (2-3 paragraphs). Address specific weaknesses in their reasoning.`;
        }
        try {
            const model = UniversalAdapter.createModel(config);
            const { text } = await generateText({
                model,
                prompt,
                maxTokens: 500,
            });
            return {
                id: `arg_${++this.argumentCounter}`,
                memberId: member.id,
                type,
                targetArgumentId: targetPosition ? `pos_${targetPosition.memberId}` : undefined,
                content: text,
                strength: 0.5, // Will be evaluated
                round,
            };
        }
        catch (error) {
            console.warn(`[DebateEngine] Failed to generate argument: ${error.message}`);
            return null;
        }
    }
    async generateCritique(critic, argument, question) {
        const config = this.registry.getConfig(critic.name);
        if (!config)
            return null;
        const prompt = `You are ${critic.name}, a critical analyst with expertise in ${critic.expertise.join(', ')}.

Analyze the following argument for logical flaws, missing evidence, assumptions, scope issues, or practical concerns.

QUESTION CONTEXT: ${question}

ARGUMENT TO CRITIQUE:
${argument.content}

Provide your critique in JSON format:
{
    "points": [
        {
            "type": "logical_flaw|missing_evidence|assumption|scope_issue|practical_concern",
            "description": "Description of the issue",
            "severity": "critical|major|minor"
        }
    ],
    "overallAssessment": "strong|moderate|weak",
    "suggestedImprovements": ["improvement1", "improvement2"]
}`;
        try {
            const model = UniversalAdapter.createModel(config);
            const { text } = await generateText({
                model,
                prompt,
                maxTokens: 500,
            });
            const parsed = this.parseCritiqueResponse(text, critic.id, argument);
            return parsed;
        }
        catch (error) {
            console.warn(`[DebateEngine] Failed to generate critique: ${error.message}`);
            return null;
        }
    }
    parseCritiqueResponse(text, criticId, argument) {
        try {
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return {
                    criticId,
                    targetMemberId: argument.memberId,
                    targetArgumentId: argument.id,
                    points: parsed.points || [],
                    overallAssessment: parsed.overallAssessment || 'moderate',
                    suggestedImprovements: parsed.suggestedImprovements || [],
                };
            }
        }
        catch {
            // Fall through
        }
        return null;
    }
    async updatePosition(member, currentPosition, critiques, counterArguments, question) {
        const config = this.registry.getConfig(member.name);
        if (!config)
            return currentPosition;
        const critiqueSummary = critiques
            .map((c) => `- ${c.overallAssessment}: ${c.points.map((p) => p.description).join('; ')}`)
            .join('\n');
        const counterSummary = counterArguments.map((a) => `- ${a.content.substring(0, 200)}`).join('\n');
        const prompt = `You are ${member.name}. Your openness to changing positions is ${member.personality.openness.toFixed(2)}.

Based on the critiques and counter-arguments received, consider whether to update your position.

QUESTION: ${question}
YOUR CURRENT POSITION: ${currentPosition.stance}
YOUR REASONING: ${currentPosition.reasoning}

CRITIQUES RECEIVED:
${critiqueSummary || 'None'}

COUNTER-ARGUMENTS RECEIVED:
${counterSummary || 'None'}

Should you update your position? Respond with JSON:
{
    "stance": "Your position (updated or unchanged)",
    "reasoning": "Your updated reasoning",
    "confidence": 0.0 to 1.0,
    "supportingEvidence": ["evidence1"],
    "potentialWeaknesses": ["weakness1"],
    "positionChanged": true/false
}`;
        try {
            const model = UniversalAdapter.createModel(config);
            const { text } = await generateText({
                model,
                prompt,
                maxTokens: 600,
            });
            return this.parsePositionResponse(text, member.id);
        }
        catch {
            return currentPosition;
        }
    }
    buildPersonalityPrompt(personality) {
        let prompt = 'Your personality traits for this debate:\n';
        if (personality.assertiveness > 0.7) {
            prompt += '- You are highly assertive and defend your positions strongly.\n';
        }
        else if (personality.assertiveness < 0.3) {
            prompt += '- You are diplomatic and seek common ground.\n';
        }
        if (personality.criticalThinking > 0.7) {
            prompt += '- You analyze deeply and question assumptions rigorously.\n';
        }
        if (personality.creativity > 0.7) {
            prompt += '- You often propose novel and unconventional solutions.\n';
        }
        if (personality.openness > 0.7) {
            prompt += '- You are open to changing your position when presented with good arguments.\n';
        }
        return prompt;
    }
    calculateConsensusLevel(positions) {
        if (positions.size <= 1)
            return 1.0;
        const stances = Array.from(positions.values()).map((p) => p.stance.toLowerCase());
        const uniqueStances = new Set(stances);
        // Simple similarity - in production, use embedding similarity
        return 1 - (uniqueStances.size - 1) / positions.size;
    }
}
// ============================================================================
// Consensus Builder
// ============================================================================
/**
 * Builds consensus from diverse positions using various strategies
 */
export class ConsensusBuilder {
    strategy;
    constructor(strategy = 'majority') {
        this.strategy = strategy;
    }
    setStrategy(strategy) {
        this.strategy = strategy;
    }
    /**
     * Build consensus from positions
     */
    buildConsensus(positions, members) {
        switch (this.strategy) {
            case 'majority':
                return this.majorityVote(positions, members);
            case 'weighted_expertise':
                return this.weightedExpertiseVote(positions, members);
            case 'unanimous':
                return this.unanimousConsensus(positions, members);
            case 'supermajority':
                return this.supermajorityVote(positions, members);
            default:
                return this.majorityVote(positions, members);
        }
    }
    majorityVote(positions, members) {
        const voteMap = new Map();
        for (const [memberId, position] of positions) {
            const stance = this.normalizeStance(position.stance);
            if (!voteMap.has(stance)) {
                voteMap.set(stance, []);
            }
            voteMap.get(stance).push(memberId);
        }
        let winner = null;
        let maxVotes = 0;
        for (const [stance, voters] of voteMap) {
            if (voters.length > maxVotes) {
                maxVotes = voters.length;
                winner = stance;
            }
        }
        const totalVoters = positions.size;
        const consensusLevel = maxVotes / totalVoters;
        const dissent = [];
        if (winner) {
            for (const [memberId, position] of positions) {
                if (this.normalizeStance(position.stance) !== winner) {
                    dissent.push(memberId);
                }
            }
        }
        return {
            strategy: 'majority',
            winner,
            votes: voteMap,
            consensusReached: consensusLevel > 0.5,
            consensusLevel,
            dissent,
        };
    }
    weightedExpertiseVote(positions, members) {
        const memberMap = new Map(members.map((m) => [m.id, m]));
        const weightedVotes = new Map();
        for (const [memberId, position] of positions) {
            const member = memberMap.get(memberId);
            const weight = member?.weight || 0.5;
            const confidence = position.confidence;
            const effectiveWeight = weight * confidence;
            const stance = this.normalizeStance(position.stance);
            weightedVotes.set(stance, (weightedVotes.get(stance) || 0) + effectiveWeight);
        }
        let winner = null;
        let maxWeight = 0;
        let totalWeight = 0;
        for (const [stance, weight] of weightedVotes) {
            totalWeight += weight;
            if (weight > maxWeight) {
                maxWeight = weight;
                winner = stance;
            }
        }
        const consensusLevel = totalWeight > 0 ? maxWeight / totalWeight : 0;
        const dissent = [];
        const voteMap = new Map();
        for (const [memberId, position] of positions) {
            const stance = this.normalizeStance(position.stance);
            if (!voteMap.has(stance)) {
                voteMap.set(stance, []);
            }
            voteMap.get(stance).push(memberId);
            if (winner && stance !== winner) {
                dissent.push(memberId);
            }
        }
        return {
            strategy: 'weighted_expertise',
            winner,
            votes: voteMap,
            consensusReached: consensusLevel > 0.5,
            consensusLevel,
            dissent,
        };
    }
    unanimousConsensus(positions, members) {
        const stances = new Set(Array.from(positions.values()).map((p) => this.normalizeStance(p.stance)));
        const voteMap = new Map();
        for (const [memberId, position] of positions) {
            const stance = this.normalizeStance(position.stance);
            if (!voteMap.has(stance)) {
                voteMap.set(stance, []);
            }
            voteMap.get(stance).push(memberId);
        }
        const unanimous = stances.size === 1;
        return {
            strategy: 'unanimous',
            winner: unanimous ? Array.from(stances)[0] : null,
            votes: voteMap,
            consensusReached: unanimous,
            consensusLevel: unanimous ? 1.0 : 0,
            dissent: unanimous ? [] : Array.from(positions.keys()),
        };
    }
    supermajorityVote(positions, members) {
        const result = this.majorityVote(positions, members);
        const threshold = 2 / 3;
        return {
            ...result,
            strategy: 'supermajority',
            consensusReached: result.consensusLevel >= threshold,
        };
    }
    normalizeStance(stance) {
        // Normalize stance for comparison - extract key position
        return stance.toLowerCase().trim().substring(0, 100);
    }
}
// ============================================================================
// Synthesis Engine
// ============================================================================
/**
 * Synthesizes the best answer from multiple perspectives
 */
export class SynthesisEngine {
    modelRouter;
    registry;
    constructor(modelRouter) {
        this.modelRouter = modelRouter;
        this.registry = modelRouter.getRegistry();
    }
    /**
     * Synthesize a final answer from debate results
     */
    async synthesize(question, positions, debateRounds, voteResult, members) {
        const memberMap = new Map(members.map((m) => [m.id, m]));
        // Collect all strong arguments
        const strongArguments = debateRounds
            .flatMap((r) => r.arguments)
            .filter((a) => a.strength > 0.6)
            .sort((a, b) => b.strength - a.strength)
            .slice(0, 10);
        // Collect position summaries
        const positionSummaries = Array.from(positions.entries())
            .map(([id, pos]) => {
            const member = memberMap.get(id);
            return `${member?.name || 'Unknown'} (confidence: ${pos.confidence.toFixed(2)}): ${pos.stance}\nReasoning: ${pos.reasoning}`;
        })
            .join('\n\n');
        // Build synthesis prompt
        const prompt = `You are a neutral synthesizer tasked with combining multiple expert perspectives into a coherent final answer.

ORIGINAL QUESTION: ${question}

COUNCIL VOTE RESULT:
- Strategy: ${voteResult.strategy}
- Winner: ${voteResult.winner || 'No clear winner'}
- Consensus Level: ${(voteResult.consensusLevel * 100).toFixed(1)}%
- Dissenters: ${voteResult.dissent.length} members

POSITION SUMMARIES:
${positionSummaries}

STRONGEST ARGUMENTS FROM DEBATE:
${strongArguments.map((a) => `- ${a.content.substring(0, 300)}...`).join('\n')}

Create a synthesized answer that:
1. Incorporates the best insights from all positions
2. Acknowledges areas of agreement and disagreement
3. Provides a balanced, well-reasoned conclusion
4. Notes any important caveats or limitations

Respond in JSON format:
{
    "answer": "The synthesized answer",
    "reasoning": "Explanation of how this conclusion was reached",
    "confidence": 0.0 to 1.0
}`;
        // Use the most capable available model for synthesis
        const models = this.registry.listModels();
        let synthesisConfig;
        for (const modelName of ['claude-3-opus', 'gpt-4', 'claude-3-sonnet', 'gpt-4-turbo', 'gemini-1.5-pro']) {
            synthesisConfig = this.registry.getConfig(modelName);
            if (synthesisConfig)
                break;
        }
        if (!synthesisConfig) {
            synthesisConfig = this.registry.getConfig(models[0]);
        }
        if (!synthesisConfig) {
            return {
                answer: voteResult.winner || 'Unable to synthesize - no models available',
                reasoning: 'Synthesis failed due to missing model configuration',
                confidence: 0.3,
            };
        }
        try {
            const model = UniversalAdapter.createModel(synthesisConfig);
            const { text } = await generateText({
                model,
                prompt,
                maxTokens: 1500,
            });
            return this.parseSynthesisResponse(text);
        }
        catch (error) {
            console.error(`[SynthesisEngine] Synthesis failed: ${error.message}`);
            return {
                answer: voteResult.winner || 'Synthesis failed',
                reasoning: error.message,
                confidence: 0.3,
            };
        }
    }
    parseSynthesisResponse(text) {
        try {
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return {
                    answer: parsed.answer || text,
                    reasoning: parsed.reasoning || '',
                    confidence: Math.max(0, Math.min(1, parsed.confidence || 0.5)),
                };
            }
        }
        catch {
            // Fall through
        }
        return {
            answer: text,
            reasoning: '',
            confidence: 0.5,
        };
    }
}
// ============================================================================
// Thinking Council (Main Class)
// ============================================================================
/**
 * Multi-Model Thinking Council
 *
 * A council of AI models that debate complex questions and reach consensus
 * through structured deliberation.
 */
export class ThinkingCouncil {
    modelRouter;
    memory;
    debateEngine;
    consensusBuilder;
    synthesisEngine;
    members = [];
    defaultConfig = {
        maxDebateRounds: 3,
        consensusStrategy: 'weighted_expertise',
        minConsensusThreshold: 0.7,
        allowMemberAbstention: true,
        enableSynthesis: true,
        timeoutMs: 120000,
        expertiseWeighting: true,
    };
    constructor(modelRouter, memory) {
        this.modelRouter = modelRouter;
        this.memory = memory;
        this.debateEngine = new DebateEngine(modelRouter);
        this.consensusBuilder = new ConsensusBuilder();
        this.synthesisEngine = new SynthesisEngine(modelRouter);
        // Initialize default council members based on available models
        this.initializeDefaultMembers();
    }
    /**
     * Initialize council members from registered models
     */
    initializeDefaultMembers() {
        const registry = this.modelRouter.getRegistry();
        const models = registry.listModels();
        for (const modelName of models) {
            const config = registry.getConfig(modelName);
            if (!config)
                continue;
            const member = this.createMemberFromConfig(config);
            if (member) {
                this.members.push(member);
            }
        }
        console.log(`[ThinkingCouncil] Initialized with ${this.members.length} council members`);
    }
    createMemberFromConfig(config) {
        // Assign expertise and personality based on model type
        let expertise = ['general'];
        let personality = {
            assertiveness: 0.5,
            openness: 0.5,
            criticalThinking: 0.5,
            creativity: 0.5,
        };
        let weight = 0.5;
        if (config.providerType === 'anthropic') {
            expertise = ['architecture', 'security', 'code_quality'];
            personality = {
                assertiveness: 0.7,
                openness: 0.6,
                criticalThinking: 0.9,
                creativity: 0.7,
            };
            weight = 0.8;
        }
        else if (config.providerType === 'openai') {
            expertise = ['general', 'user_experience', 'data'];
            personality = {
                assertiveness: 0.6,
                openness: 0.7,
                criticalThinking: 0.8,
                creativity: 0.6,
            };
            weight = 0.75;
        }
        else if (config.providerType === 'google') {
            expertise = ['ml', 'performance', 'data'];
            personality = {
                assertiveness: 0.5,
                openness: 0.8,
                criticalThinking: 0.7,
                creativity: 0.8,
            };
            weight = 0.7;
        }
        return {
            id: `member_${config.name}`,
            name: config.name,
            provider: config.providerType,
            modelId: config.modelId,
            expertise,
            weight,
            personality,
        };
    }
    /**
     * Add a council member
     */
    addMember(member) {
        // Verify model is registered
        const config = this.modelRouter.getRegistry().getConfig(member.name);
        if (!config) {
            console.warn(`[ThinkingCouncil] Model ${member.name} not registered, cannot add as member`);
            return;
        }
        this.members.push(member);
        console.log(`[ThinkingCouncil] Added council member: ${member.name}`);
    }
    /**
     * Remove a council member
     */
    removeMember(memberId) {
        const index = this.members.findIndex((m) => m.id === memberId);
        if (index >= 0) {
            this.members.splice(index, 1);
            return true;
        }
        return false;
    }
    /**
     * Get current council members
     */
    getMembers() {
        return [...this.members];
    }
    /**
     * Main deliberation method - queries multiple models, conducts debate, reaches consensus
     */
    async deliberate(question, options = [], config = {}) {
        const startTime = Date.now();
        const mergedConfig = { ...this.defaultConfig, ...config };
        console.log(`[ThinkingCouncil] Starting deliberation on: "${question}"`);
        console.log(`[ThinkingCouncil] Council size: ${this.members.length} members`);
        console.log(`[ThinkingCouncil] Strategy: ${mergedConfig.consensusStrategy}`);
        // Check for cached deliberations
        const cachedResult = await this.checkCache(question);
        if (cachedResult) {
            console.log('[ThinkingCouncil] Found cached deliberation result');
            return cachedResult;
        }
        // Validate we have enough members
        if (this.members.length < 2) {
            throw new Error('ThinkingCouncil requires at least 2 members for deliberation');
        }
        // Set consensus strategy
        this.consensusBuilder.setStrategy(mergedConfig.consensusStrategy);
        // Conduct debate
        const debateRounds = await this.debateEngine.conductDebate(question, options, this.members, mergedConfig);
        // Collect final positions
        const finalPositions = new Map();
        for (const round of debateRounds) {
            for (const posUpdate of round.positionUpdates) {
                finalPositions.set(posUpdate.memberId, posUpdate);
            }
        }
        // If no position updates, use initial positions from first round arguments
        if (finalPositions.size === 0 && debateRounds.length > 0) {
            for (const member of this.members) {
                finalPositions.set(member.id, {
                    memberId: member.id,
                    stance: 'Position not established',
                    reasoning: '',
                    confidence: 0.3,
                    supportingEvidence: [],
                    potentialWeaknesses: [],
                    timestamp: new Date(),
                });
            }
        }
        // Build consensus
        const voteResult = this.consensusBuilder.buildConsensus(finalPositions, this.members);
        // Track voting history
        const votingHistory = [voteResult];
        // Synthesize final answer if enabled
        let finalAnswer;
        let synthesizedReasoning;
        let confidence;
        if (mergedConfig.enableSynthesis) {
            const synthesis = await this.synthesisEngine.synthesize(question, finalPositions, debateRounds, voteResult, this.members);
            finalAnswer = synthesis.answer;
            synthesizedReasoning = synthesis.reasoning;
            confidence = synthesis.confidence;
        }
        else {
            finalAnswer = voteResult.winner || 'No consensus reached';
            synthesizedReasoning = 'Synthesis disabled';
            confidence = voteResult.consensusLevel;
        }
        // Build dissent records
        const dissent = voteResult.dissent.map((memberId) => {
            const member = this.members.find((m) => m.id === memberId);
            const position = finalPositions.get(memberId);
            return {
                memberId,
                memberName: member?.name || 'Unknown',
                position: position?.stance || 'Unknown position',
                reasoning: position?.reasoning || '',
            };
        });
        const result = {
            question,
            options,
            finalAnswer,
            synthesizedReasoning,
            consensusLevel: voteResult.consensusLevel,
            participatingMembers: this.members,
            debateRounds,
            votingHistory,
            dissent,
            confidence,
            deliberationTimeMs: Date.now() - startTime,
            metadata: {
                strategy: mergedConfig.consensusStrategy,
                totalArguments: debateRounds.reduce((sum, r) => sum + r.arguments.length, 0),
                critiquesExchanged: debateRounds.reduce((sum, r) => sum + r.critiques.length, 0),
            },
        };
        // Cache result
        await this.cacheResult(question, result);
        console.log(`[ThinkingCouncil] Deliberation complete in ${result.deliberationTimeMs}ms`);
        console.log(`[ThinkingCouncil] Consensus level: ${(result.consensusLevel * 100).toFixed(1)}%`);
        console.log(`[ThinkingCouncil] Confidence: ${(result.confidence * 100).toFixed(1)}%`);
        return result;
    }
    /**
     * Quick deliberation with reduced rounds for simpler questions
     */
    async quickDeliberate(question, options = []) {
        return this.deliberate(question, options, {
            maxDebateRounds: 1,
            enableSynthesis: true,
        });
    }
    /**
     * Deep deliberation with extended rounds for complex questions
     */
    async deepDeliberate(question, options = []) {
        return this.deliberate(question, options, {
            maxDebateRounds: 5,
            consensusStrategy: 'supermajority',
            minConsensusThreshold: 0.8,
            enableSynthesis: true,
        });
    }
    /**
     * Check cache for previous deliberations on similar questions
     */
    async checkCache(question) {
        try {
            const results = await this.memory.search(`council_deliberation: ${question}`, 1, 'system');
            if (results.length > 0 && results[0]) {
                const metadata = results[0].metadata;
                if (metadata?.type === 'council_deliberation') {
                    // Check if cache is still fresh (24 hours)
                    const cachedAt = new Date(metadata.timestamp || 0);
                    const hoursSinceCached = (Date.now() - cachedAt.getTime()) / (1000 * 60 * 60);
                    if (hoursSinceCached < 24) {
                        return JSON.parse(results[0].text);
                    }
                }
            }
        }
        catch {
            // Cache miss is fine
        }
        return null;
    }
    /**
     * Cache deliberation result
     */
    async cacheResult(question, result) {
        try {
            await this.memory.addMemory(JSON.stringify(result), {
                type: 'council_deliberation',
                question,
                consensusLevel: result.consensusLevel,
                timestamp: new Date().toISOString(),
            }, 'system');
        }
        catch (error) {
            console.warn('[ThinkingCouncil] Failed to cache result:', error);
        }
    }
    /**
     * Get a summary of the last deliberation suitable for logging
     */
    static summarizeResult(result) {
        return `
=== THINKING COUNCIL DELIBERATION SUMMARY ===
Question: ${result.question}
Time: ${result.deliberationTimeMs}ms
Strategy: ${result.metadata.strategy}

FINAL ANSWER:
${result.finalAnswer}

REASONING:
${result.synthesizedReasoning}

CONSENSUS: ${(result.consensusLevel * 100).toFixed(1)}%
CONFIDENCE: ${(result.confidence * 100).toFixed(1)}%

PARTICIPATING MODELS (${result.participatingMembers.length}):
${result.participatingMembers.map((m) => `- ${m.name} (${m.provider})`).join('\n')}

DEBATE STATISTICS:
- Rounds: ${result.debateRounds.length}
- Arguments: ${result.metadata.totalArguments}
- Critiques: ${result.metadata.critiquesExchanged}

${result.dissent.length > 0
            ? `DISSENTING OPINIONS (${result.dissent.length}):
${result.dissent.map((d) => `- ${d.memberName}: ${d.position}`).join('\n')}`
            : 'NO DISSENTING OPINIONS'}
==============================================
        `.trim();
    }
}
// ============================================================================
// Exports
// ============================================================================
export default ThinkingCouncil;
//# sourceMappingURL=ThinkingCouncil.js.map