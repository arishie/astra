import { ModelRouter } from '../llm/ModelRouter.js';
import { LanceManager } from '../memory/LanceManager.js';
/**
 * Represents a participating AI model in the council
 */
export interface CouncilMember {
    id: string;
    name: string;
    provider: 'openai' | 'anthropic' | 'google' | 'openai-compatible';
    modelId: string;
    expertise: ExpertiseArea[];
    weight: number;
    personality: MemberPersonality;
}
/**
 * Areas of expertise that can be assigned to council members
 */
export type ExpertiseArea = 'architecture' | 'security' | 'performance' | 'user_experience' | 'code_quality' | 'testing' | 'devops' | 'data' | 'ml' | 'general';
/**
 * Personality traits that influence how a member argues
 */
export interface MemberPersonality {
    assertiveness: number;
    openness: number;
    criticalThinking: number;
    creativity: number;
}
/**
 * A position taken by a council member on a question
 */
export interface Position {
    memberId: string;
    stance: string;
    reasoning: string;
    confidence: number;
    supportingEvidence: string[];
    potentialWeaknesses: string[];
    timestamp: Date;
}
/**
 * An argument made during debate
 */
export interface Argument {
    id: string;
    memberId: string;
    type: 'support' | 'counter' | 'refinement' | 'synthesis';
    targetArgumentId?: string;
    content: string;
    strength: number;
    round: number;
}
/**
 * A critique of another member's reasoning
 */
export interface Critique {
    criticId: string;
    targetMemberId: string;
    targetArgumentId: string;
    points: CritiquePoint[];
    overallAssessment: 'strong' | 'moderate' | 'weak';
    suggestedImprovements: string[];
}
export interface CritiquePoint {
    type: 'logical_flaw' | 'missing_evidence' | 'assumption' | 'scope_issue' | 'practical_concern';
    description: string;
    severity: 'critical' | 'major' | 'minor';
}
/**
 * The result of a voting round
 */
export interface VoteResult {
    strategy: ConsensusStrategy;
    winner: string | null;
    votes: Map<string, string[]>;
    consensusReached: boolean;
    consensusLevel: number;
    dissent: string[];
}
/**
 * Strategies for reaching consensus
 */
export type ConsensusStrategy = 'majority' | 'weighted_expertise' | 'unanimous' | 'supermajority';
/**
 * Configuration options for a council session
 */
export interface CouncilConfig {
    maxDebateRounds: number;
    consensusStrategy: ConsensusStrategy;
    minConsensusThreshold: number;
    allowMemberAbstention: boolean;
    enableSynthesis: boolean;
    timeoutMs: number;
    expertiseWeighting: boolean;
}
/**
 * The final deliberation result
 */
export interface DeliberationResult {
    question: string;
    options: string[];
    finalAnswer: string;
    synthesizedReasoning: string;
    consensusLevel: number;
    participatingMembers: CouncilMember[];
    debateRounds: DebateRound[];
    votingHistory: VoteResult[];
    dissent: DissentRecord[];
    confidence: number;
    deliberationTimeMs: number;
    metadata: {
        strategy: ConsensusStrategy;
        totalArguments: number;
        critiquesExchanged: number;
    };
}
export interface DebateRound {
    roundNumber: number;
    arguments: Argument[];
    critiques: Critique[];
    positionUpdates: Position[];
}
export interface DissentRecord {
    memberId: string;
    memberName: string;
    position: string;
    reasoning: string;
}
/**
 * Evaluates the strength of arguments using multiple criteria
 */
export declare class ArgumentEvaluator {
    private modelRouter;
    constructor(modelRouter: ModelRouter);
    /**
     * Score an argument based on multiple criteria
     */
    evaluateArgument(argument: Argument, context: string): Promise<number>;
    private evaluateLogicalCoherence;
    private evaluateEvidenceSupport;
    private evaluatePracticalFeasibility;
    private evaluateNovelty;
    private evaluateCompleteness;
    /**
     * Compare two arguments and determine which is stronger
     */
    compareArguments(arg1: Argument, arg2: Argument, context: string): Promise<string>;
}
/**
 * Manages rounds of debate between council members
 */
export declare class DebateEngine {
    private modelRouter;
    private registry;
    private argumentEvaluator;
    private argumentCounter;
    constructor(modelRouter: ModelRouter);
    /**
     * Conduct a full debate session
     */
    conductDebate(question: string, options: string[], members: CouncilMember[], config: CouncilConfig): Promise<DebateRound[]>;
    /**
     * Get initial positions from all members
     */
    private getInitialPositions;
    /**
     * Get a position from a specific member
     */
    private getMemberPosition;
    private parsePositionResponse;
    /**
     * Conduct a single debate round
     */
    private conductRound;
    private generateArgument;
    private generateCritique;
    private parseCritiqueResponse;
    private updatePosition;
    private buildPersonalityPrompt;
    private calculateConsensusLevel;
}
/**
 * Builds consensus from diverse positions using various strategies
 */
export declare class ConsensusBuilder {
    private strategy;
    constructor(strategy?: ConsensusStrategy);
    setStrategy(strategy: ConsensusStrategy): void;
    /**
     * Build consensus from positions
     */
    buildConsensus(positions: Map<string, Position>, members: CouncilMember[]): VoteResult;
    private majorityVote;
    private weightedExpertiseVote;
    private unanimousConsensus;
    private supermajorityVote;
    private normalizeStance;
}
/**
 * Synthesizes the best answer from multiple perspectives
 */
export declare class SynthesisEngine {
    private modelRouter;
    private registry;
    constructor(modelRouter: ModelRouter);
    /**
     * Synthesize a final answer from debate results
     */
    synthesize(question: string, positions: Map<string, Position>, debateRounds: DebateRound[], voteResult: VoteResult, members: CouncilMember[]): Promise<{
        answer: string;
        reasoning: string;
        confidence: number;
    }>;
    private parseSynthesisResponse;
}
/**
 * Multi-Model Thinking Council
 *
 * A council of AI models that debate complex questions and reach consensus
 * through structured deliberation.
 */
export declare class ThinkingCouncil {
    private modelRouter;
    private memory;
    private debateEngine;
    private consensusBuilder;
    private synthesisEngine;
    private members;
    private defaultConfig;
    constructor(modelRouter: ModelRouter, memory: LanceManager);
    /**
     * Initialize council members from registered models
     */
    private initializeDefaultMembers;
    private createMemberFromConfig;
    /**
     * Add a council member
     */
    addMember(member: CouncilMember): void;
    /**
     * Remove a council member
     */
    removeMember(memberId: string): boolean;
    /**
     * Get current council members
     */
    getMembers(): CouncilMember[];
    /**
     * Main deliberation method - queries multiple models, conducts debate, reaches consensus
     */
    deliberate(question: string, options?: string[], config?: Partial<CouncilConfig>): Promise<DeliberationResult>;
    /**
     * Quick deliberation with reduced rounds for simpler questions
     */
    quickDeliberate(question: string, options?: string[]): Promise<DeliberationResult>;
    /**
     * Deep deliberation with extended rounds for complex questions
     */
    deepDeliberate(question: string, options?: string[]): Promise<DeliberationResult>;
    /**
     * Check cache for previous deliberations on similar questions
     */
    private checkCache;
    /**
     * Cache deliberation result
     */
    private cacheResult;
    /**
     * Get a summary of the last deliberation suitable for logging
     */
    static summarizeResult(result: DeliberationResult): string;
}
export default ThinkingCouncil;
//# sourceMappingURL=ThinkingCouncil.d.ts.map