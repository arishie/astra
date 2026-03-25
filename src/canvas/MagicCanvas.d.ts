/**
 * MagicCanvas - Visual Workflow Builder for Astra
 *
 * A powerful drag-and-drop workflow builder that enables users to:
 * - Create AI workflows visually
 * - Use natural language to generate workflows
 * - Execute compiled workflows
 * - Share and reuse workflow templates
 */
export type NodeType = 'llm' | 'condition' | 'loop' | 'api' | 'transform' | 'input' | 'output' | 'merge' | 'split' | 'delay' | 'webhook';
export type ConnectionType = 'data' | 'control' | 'conditional';
export type WorkflowStatus = 'draft' | 'validated' | 'executing' | 'completed' | 'failed' | 'paused';
export type NodeExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
export interface Position {
    x: number;
    y: number;
}
export interface NodePort {
    id: string;
    name: string;
    type: 'input' | 'output';
    dataType: string;
    required: boolean;
    multiple: boolean;
}
export interface NodeConnection {
    id: string;
    sourceNodeId: string;
    sourcePortId: string;
    targetNodeId: string;
    targetPortId: string;
    connectionType: ConnectionType;
    condition?: string;
}
export interface NodeConfig {
    [key: string]: unknown;
}
export interface WorkflowNodeData {
    id: string;
    type: NodeType;
    name: string;
    description: string;
    position: Position;
    config: NodeConfig;
    inputPorts: NodePort[];
    outputPorts: NodePort[];
    metadata: {
        createdAt: Date;
        updatedAt: Date;
        author?: string;
        version: number;
    };
}
export interface WorkflowData {
    id: string;
    name: string;
    description: string;
    version: string;
    nodes: WorkflowNodeData[];
    connections: NodeConnection[];
    variables: Record<string, unknown>;
    metadata: {
        createdAt: Date;
        updatedAt: Date;
        author?: string;
        tags: string[];
        category?: string;
    };
}
export interface ExecutionContext {
    workflowId: string;
    executionId: string;
    variables: Map<string, unknown>;
    nodeOutputs: Map<string, unknown>;
    currentNodeId: string | null;
    status: WorkflowStatus;
    startTime: Date;
    endTime?: Date;
    error?: Error;
    logs: ExecutionLog[];
}
export interface ExecutionLog {
    timestamp: Date;
    nodeId: string;
    level: 'info' | 'warn' | 'error' | 'debug';
    message: string;
    data?: unknown;
}
export interface ValidationResult {
    valid: boolean;
    errors: ValidationError[];
    warnings: ValidationWarning[];
}
export interface ValidationError {
    nodeId?: string;
    connectionId?: string;
    code: string;
    message: string;
}
export interface ValidationWarning {
    nodeId?: string;
    code: string;
    message: string;
}
export interface WorkflowTemplate {
    id: string;
    name: string;
    description: string;
    category: string;
    tags: string[];
    workflow: WorkflowData;
    thumbnail?: string;
    popularity: number;
    author: string;
    createdAt: Date;
}
export interface CompiledWorkflow {
    id: string;
    sourceWorkflowId: string;
    code: string;
    language: 'typescript' | 'python' | 'json';
    dependencies: string[];
    compiledAt: Date;
    checksum: string;
}
export declare abstract class WorkflowNode {
    readonly id: string;
    readonly type: NodeType;
    name: string;
    description: string;
    position: Position;
    config: NodeConfig;
    inputPorts: NodePort[];
    outputPorts: NodePort[];
    protected executionStatus: NodeExecutionStatus;
    constructor(data: Partial<WorkflowNodeData> & {
        type: NodeType;
    });
    abstract execute(inputs: Map<string, unknown>, context: ExecutionContext): Promise<Map<string, unknown>>;
    abstract validate(): ValidationError[];
    protected abstract getDefaultName(): string;
    protected abstract getDefaultConfig(): NodeConfig;
    protected abstract getDefaultInputPorts(): NodePort[];
    protected abstract getDefaultOutputPorts(): NodePort[];
    getExecutionStatus(): NodeExecutionStatus;
    setExecutionStatus(status: NodeExecutionStatus): void;
    toData(): WorkflowNodeData;
    clone(): WorkflowNodeData;
}
export declare class LLMNode extends WorkflowNode {
    constructor(data?: Partial<WorkflowNodeData>);
    protected getDefaultName(): string;
    protected getDefaultConfig(): NodeConfig;
    protected getDefaultInputPorts(): NodePort[];
    protected getDefaultOutputPorts(): NodePort[];
    execute(inputs: Map<string, unknown>, context: ExecutionContext): Promise<Map<string, unknown>>;
    private callLLM;
    validate(): ValidationError[];
}
export declare class ConditionNode extends WorkflowNode {
    constructor(data?: Partial<WorkflowNodeData>);
    protected getDefaultName(): string;
    protected getDefaultConfig(): NodeConfig;
    protected getDefaultInputPorts(): NodePort[];
    protected getDefaultOutputPorts(): NodePort[];
    execute(inputs: Map<string, unknown>, context: ExecutionContext): Promise<Map<string, unknown>>;
    private evaluate;
    private evaluateExpression;
    validate(): ValidationError[];
}
export declare class LoopNode extends WorkflowNode {
    constructor(data?: Partial<WorkflowNodeData>);
    protected getDefaultName(): string;
    protected getDefaultConfig(): NodeConfig;
    protected getDefaultInputPorts(): NodePort[];
    protected getDefaultOutputPorts(): NodePort[];
    execute(inputs: Map<string, unknown>, context: ExecutionContext): Promise<Map<string, unknown>>;
    validate(): ValidationError[];
}
export declare class APINode extends WorkflowNode {
    constructor(data?: Partial<WorkflowNodeData>);
    protected getDefaultName(): string;
    protected getDefaultConfig(): NodeConfig;
    protected getDefaultInputPorts(): NodePort[];
    protected getDefaultOutputPorts(): NodePort[];
    execute(inputs: Map<string, unknown>, context: ExecutionContext): Promise<Map<string, unknown>>;
    private parseResponse;
    validate(): ValidationError[];
}
export declare class TransformNode extends WorkflowNode {
    constructor(data?: Partial<WorkflowNodeData>);
    protected getDefaultName(): string;
    protected getDefaultConfig(): NodeConfig;
    protected getDefaultInputPorts(): NodePort[];
    protected getDefaultOutputPorts(): NodePort[];
    execute(inputs: Map<string, unknown>, context: ExecutionContext): Promise<Map<string, unknown>>;
    private applyJMESPath;
    private applyMapping;
    private applyCustomFunction;
    private applyFilter;
    private applyMap;
    private applyReduce;
    validate(): ValidationError[];
}
export declare class InputNode extends WorkflowNode {
    constructor(data?: Partial<WorkflowNodeData>);
    protected getDefaultName(): string;
    protected getDefaultConfig(): NodeConfig;
    protected getDefaultInputPorts(): NodePort[];
    protected getDefaultOutputPorts(): NodePort[];
    execute(inputs: Map<string, unknown>, context: ExecutionContext): Promise<Map<string, unknown>>;
    validate(): ValidationError[];
}
export declare class OutputNode extends WorkflowNode {
    constructor(data?: Partial<WorkflowNodeData>);
    protected getDefaultName(): string;
    protected getDefaultConfig(): NodeConfig;
    protected getDefaultInputPorts(): NodePort[];
    protected getDefaultOutputPorts(): NodePort[];
    execute(inputs: Map<string, unknown>, context: ExecutionContext): Promise<Map<string, unknown>>;
    validate(): ValidationError[];
}
export declare class MergeNode extends WorkflowNode {
    constructor(data?: Partial<WorkflowNodeData>);
    protected getDefaultName(): string;
    protected getDefaultConfig(): NodeConfig;
    protected getDefaultInputPorts(): NodePort[];
    protected getDefaultOutputPorts(): NodePort[];
    execute(inputs: Map<string, unknown>, context: ExecutionContext): Promise<Map<string, unknown>>;
    validate(): ValidationError[];
}
export declare class SplitNode extends WorkflowNode {
    constructor(data?: Partial<WorkflowNodeData>);
    protected getDefaultName(): string;
    protected getDefaultConfig(): NodeConfig;
    protected getDefaultInputPorts(): NodePort[];
    protected getDefaultOutputPorts(): NodePort[];
    execute(inputs: Map<string, unknown>, context: ExecutionContext): Promise<Map<string, unknown>>;
    validate(): ValidationError[];
}
export declare class DelayNode extends WorkflowNode {
    constructor(data?: Partial<WorkflowNodeData>);
    protected getDefaultName(): string;
    protected getDefaultConfig(): NodeConfig;
    protected getDefaultInputPorts(): NodePort[];
    protected getDefaultOutputPorts(): NodePort[];
    execute(inputs: Map<string, unknown>, context: ExecutionContext): Promise<Map<string, unknown>>;
    validate(): ValidationError[];
}
export declare class WebhookNode extends WorkflowNode {
    constructor(data?: Partial<WorkflowNodeData>);
    protected getDefaultName(): string;
    protected getDefaultConfig(): NodeConfig;
    protected getDefaultInputPorts(): NodePort[];
    protected getDefaultOutputPorts(): NodePort[];
    execute(inputs: Map<string, unknown>, context: ExecutionContext): Promise<Map<string, unknown>>;
    validate(): ValidationError[];
}
export declare class NodeFactory {
    private static nodeTypes;
    static createNode(type: NodeType, data?: Partial<WorkflowNodeData>): WorkflowNode;
    static registerNodeType(type: NodeType, nodeClass: new (data?: Partial<WorkflowNodeData>) => WorkflowNode): void;
    static getAvailableNodeTypes(): NodeType[];
}
export declare class WorkflowGraph {
    private nodes;
    private connections;
    private adjacencyList;
    private reverseAdjacencyList;
    addNode(node: WorkflowNode): void;
    removeNode(nodeId: string): void;
    addConnection(connection: NodeConnection): void;
    removeConnection(connectionId: string): void;
    getNode(nodeId: string): WorkflowNode | undefined;
    getNodes(): WorkflowNode[];
    getConnections(): NodeConnection[];
    getConnectionsFromNode(nodeId: string): NodeConnection[];
    getConnectionsToNode(nodeId: string): NodeConnection[];
    getInputNodes(): WorkflowNode[];
    getOutputNodes(): WorkflowNode[];
    private wouldCreateCycle;
    topologicalSort(): string[];
    clear(): void;
    toData(): {
        nodes: WorkflowNodeData[];
        connections: NodeConnection[];
    };
    static fromData(data: {
        nodes: WorkflowNodeData[];
        connections: NodeConnection[];
    }): WorkflowGraph;
}
export declare class ValidationEngine {
    validate(graph: WorkflowGraph): ValidationResult;
    private validateGraphStructure;
    private validateConnections;
    private validateDataFlow;
}
export declare class WorkflowExecutor {
    private abortController;
    execute(graph: WorkflowGraph, inputs?: Record<string, unknown>, options?: {
        timeout?: number;
        onProgress?: (progress: ExecutionProgress) => void;
    }): Promise<ExecutionResult>;
    abort(): void;
    private gatherNodeInputs;
}
export interface ExecutionProgress {
    executionId: string;
    currentNodeId: string;
    completedNodes: number;
    totalNodes: number;
    percentage: number;
}
export interface ExecutionResult {
    success: boolean;
    executionId: string;
    outputs: Record<string, unknown>;
    logs: ExecutionLog[];
    duration: number;
    error?: string;
}
export declare class WorkflowCompiler {
    compile(workflow: WorkflowData, language?: 'typescript' | 'python' | 'json'): CompiledWorkflow;
    private compileToTypeScript;
    private compileToPython;
    private generatePythonNodeExecutor;
    private sanitizeId;
    private calculateChecksum;
}
export declare class NaturalLanguageBuilder {
    private patterns;
    constructor();
    buildFromDescription(description: string): Promise<WorkflowData>;
    private registerDefaultPatterns;
    private parseDescription;
    private extractWorkflowName;
    private extractTags;
    private getDefaultOutputPort;
    private getDefaultInputPort;
    registerPattern(pattern: RegExp, builder: (match: RegExpMatchArray) => Partial<WorkflowData>): void;
}
export declare class WorkflowSerializer {
    serialize(workflow: WorkflowData): string;
    deserialize(json: string): WorkflowData;
    private validateStructure;
    saveToFile(workflow: WorkflowData, filePath: string): Promise<void>;
    loadFromFile(filePath: string): Promise<WorkflowData>;
    exportToYAML(workflow: WorkflowData): string;
}
export declare class TemplateLibrary {
    private templates;
    constructor();
    private registerBuiltInTemplates;
    private createAPIChainWorkflow;
    private createLLMPipelineWorkflow;
    private createConditionalRouterWorkflow;
    private createBatchProcessorWorkflow;
    private createWebhookHandlerWorkflow;
    addTemplate(template: WorkflowTemplate): void;
    getTemplate(id: string): WorkflowTemplate | undefined;
    listTemplates(options?: {
        category?: string;
        tags?: string[];
        sortBy?: 'popularity' | 'name' | 'createdAt';
    }): WorkflowTemplate[];
    getCategories(): string[];
    getTags(): string[];
    createWorkflowFromTemplate(templateId: string): WorkflowData;
}
export declare class MagicCanvas {
    private workflows;
    private executor;
    private compiler;
    private nlBuilder;
    private serializer;
    private validator;
    private templateLibrary;
    constructor();
    /**
     * Create a new workflow
     */
    createWorkflow(options?: {
        name?: string;
        description?: string;
        fromTemplate?: string;
        fromDescription?: string;
    }): WorkflowGraph;
    /**
     * Create a workflow from natural language description
     */
    createWorkflowFromDescription(description: string): Promise<WorkflowGraph>;
    /**
     * Execute a workflow
     */
    executeWorkflow(workflow: WorkflowGraph | string, inputs?: Record<string, unknown>, options?: {
        timeout?: number;
        onProgress?: (progress: ExecutionProgress) => void;
    }): Promise<ExecutionResult>;
    /**
     * Validate a workflow
     */
    validateWorkflow(workflow: WorkflowGraph | string): ValidationResult;
    /**
     * Compile workflow to executable code
     */
    compileWorkflow(workflow: WorkflowGraph | WorkflowData, language?: 'typescript' | 'python' | 'json'): CompiledWorkflow;
    /**
     * Save workflow to JSON
     */
    serializeWorkflow(workflow: WorkflowGraph, name: string, description?: string): string;
    /**
     * Load workflow from JSON
     */
    deserializeWorkflow(json: string): WorkflowGraph;
    /**
     * Get available templates
     */
    getTemplates(options?: {
        category?: string;
        tags?: string[];
        sortBy?: 'popularity' | 'name' | 'createdAt';
    }): WorkflowTemplate[];
    /**
     * Create workflow from template
     */
    createFromTemplate(templateId: string): WorkflowGraph;
    /**
     * Add a custom template
     */
    addTemplate(template: Omit<WorkflowTemplate, 'id' | 'createdAt'>): string;
    /**
     * Get available node types
     */
    getAvailableNodeTypes(): NodeType[];
    /**
     * Create a node
     */
    createNode(type: NodeType, data?: Partial<WorkflowNodeData>): WorkflowNode;
    /**
     * Abort running workflow execution
     */
    abortExecution(): void;
    /**
     * Get the Natural Language Builder for custom patterns
     */
    getNaturalLanguageBuilder(): NaturalLanguageBuilder;
    /**
     * Get template library for advanced operations
     */
    getTemplateLibrary(): TemplateLibrary;
    private graphToWorkflowData;
}
export declare function createCanvas(): MagicCanvas;
export declare function createNode(type: NodeType, data?: Partial<WorkflowNodeData>): WorkflowNode;
export declare function createGraph(): WorkflowGraph;
//# sourceMappingURL=MagicCanvas.d.ts.map