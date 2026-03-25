// @ts-nocheck
/**
 * MagicCanvas - Visual Workflow Builder for Astra
 *
 * A powerful drag-and-drop workflow builder that enables users to:
 * - Create AI workflows visually
 * - Use natural language to generate workflows
 * - Execute compiled workflows
 * - Share and reuse workflow templates
 */

import { randomUUID } from 'crypto';

// ============================================================================
// Types & Interfaces
// ============================================================================

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

// ============================================================================
// WorkflowNode Base Class
// ============================================================================

export abstract class WorkflowNode {
    readonly id: string;
    readonly type: NodeType;
    name: string;
    description: string;
    position: Position;
    config: NodeConfig;
    inputPorts: NodePort[];
    outputPorts: NodePort[];
    protected executionStatus: NodeExecutionStatus = 'pending';

    constructor(data: Partial<WorkflowNodeData> & { type: NodeType }) {
        this.id = data.id || randomUUID();
        this.type = data.type;
        this.name = data.name || this.getDefaultName();
        this.description = data.description || '';
        this.position = data.position || { x: 0, y: 0 };
        this.config = data.config || this.getDefaultConfig();
        this.inputPorts = data.inputPorts || this.getDefaultInputPorts();
        this.outputPorts = data.outputPorts || this.getDefaultOutputPorts();
    }

    abstract execute(inputs: Map<string, unknown>, context: ExecutionContext): Promise<Map<string, unknown>>;

    abstract validate(): ValidationError[];

    protected abstract getDefaultName(): string;
    protected abstract getDefaultConfig(): NodeConfig;
    protected abstract getDefaultInputPorts(): NodePort[];
    protected abstract getDefaultOutputPorts(): NodePort[];

    getExecutionStatus(): NodeExecutionStatus {
        return this.executionStatus;
    }

    setExecutionStatus(status: NodeExecutionStatus): void {
        this.executionStatus = status;
    }

    toData(): WorkflowNodeData {
        return {
            id: this.id,
            type: this.type,
            name: this.name,
            description: this.description,
            position: this.position,
            config: this.config,
            inputPorts: this.inputPorts,
            outputPorts: this.outputPorts,
            metadata: {
                createdAt: new Date(),
                updatedAt: new Date(),
                version: 1,
            },
        };
    }

    clone(): WorkflowNodeData {
        return {
            ...this.toData(),
            id: randomUUID(),
            position: {
                x: this.position.x + 50,
                y: this.position.y + 50,
            },
        };
    }
}

// ============================================================================
// Node Implementations
// ============================================================================

export class LLMNode extends WorkflowNode {
    constructor(data: Partial<WorkflowNodeData> = {}) {
        super({ ...data, type: 'llm' });
    }

    protected getDefaultName(): string {
        return 'LLM Call';
    }

    protected getDefaultConfig(): NodeConfig {
        return {
            model: 'gpt-4',
            systemPrompt: '',
            userPromptTemplate: '{{input}}',
            temperature: 0.7,
            maxTokens: 2048,
            topP: 1,
            frequencyPenalty: 0,
            presencePenalty: 0,
            stopSequences: [],
            responseFormat: 'text',
            retryOnFailure: true,
            maxRetries: 3,
        };
    }

    protected getDefaultInputPorts(): NodePort[] {
        return [
            {
                id: 'prompt',
                name: 'Prompt',
                type: 'input',
                dataType: 'string',
                required: true,
                multiple: false,
            },
            {
                id: 'context',
                name: 'Context',
                type: 'input',
                dataType: 'object',
                required: false,
                multiple: true,
            },
        ];
    }

    protected getDefaultOutputPorts(): NodePort[] {
        return [
            {
                id: 'response',
                name: 'Response',
                type: 'output',
                dataType: 'string',
                required: false,
                multiple: false,
            },
            {
                id: 'metadata',
                name: 'Metadata',
                type: 'output',
                dataType: 'object',
                required: false,
                multiple: false,
            },
        ];
    }

    async execute(inputs: Map<string, unknown>, context: ExecutionContext): Promise<Map<string, unknown>> {
        this.setExecutionStatus('running');
        const outputs = new Map<string, unknown>();

        try {
            const prompt = inputs.get('prompt') as string;
            const contextData = inputs.get('context');

            // Interpolate template variables
            let userPrompt = this.config.userPromptTemplate as string;
            userPrompt = userPrompt.replace('{{input}}', prompt || '');

            if (contextData && typeof contextData === 'object') {
                for (const [key, value] of Object.entries(contextData)) {
                    userPrompt = userPrompt.replace(`{{${key}}}`, String(value));
                }
            }

            // Simulate LLM call (in production, integrate with actual LLM service)
            const response = await this.callLLM(userPrompt, context);

            outputs.set('response', response.text);
            outputs.set('metadata', {
                model: this.config.model,
                tokensUsed: response.tokensUsed,
                latencyMs: response.latencyMs,
            });

            this.setExecutionStatus('completed');
        } catch (error) {
            this.setExecutionStatus('failed');
            throw error;
        }

        return outputs;
    }

    private async callLLM(prompt: string, context: ExecutionContext): Promise<{ text: string; tokensUsed: number; latencyMs: number }> {
        const startTime = Date.now();

        context.logs.push({
            timestamp: new Date(),
            nodeId: this.id,
            level: 'info',
            message: `Calling LLM with model: ${this.config.model}`,
            data: { promptLength: prompt.length },
        });

        // Placeholder for actual LLM integration
        // In production, this would call the ModelRouter
        await new Promise(resolve => setTimeout(resolve, 100));

        const latencyMs = Date.now() - startTime;

        return {
            text: `[LLM Response for: ${prompt.substring(0, 50)}...]`,
            tokensUsed: Math.ceil(prompt.length / 4),
            latencyMs,
        };
    }

    validate(): ValidationError[] {
        const errors: ValidationError[] = [];

        if (!this.config.model) {
            errors.push({
                nodeId: this.id,
                code: 'LLM_NO_MODEL',
                message: 'LLM node requires a model to be specified',
            });
        }

        if (!this.config.userPromptTemplate) {
            errors.push({
                nodeId: this.id,
                code: 'LLM_NO_PROMPT_TEMPLATE',
                message: 'LLM node requires a prompt template',
            });
        }

        return errors;
    }
}

export class ConditionNode extends WorkflowNode {
    constructor(data: Partial<WorkflowNodeData> = {}) {
        super({ ...data, type: 'condition' });
    }

    protected getDefaultName(): string {
        return 'Condition';
    }

    protected getDefaultConfig(): NodeConfig {
        return {
            expression: '',
            operator: 'equals',
            compareValue: '',
            caseSensitive: true,
        };
    }

    protected getDefaultInputPorts(): NodePort[] {
        return [
            {
                id: 'value',
                name: 'Value',
                type: 'input',
                dataType: 'any',
                required: true,
                multiple: false,
            },
        ];
    }

    protected getDefaultOutputPorts(): NodePort[] {
        return [
            {
                id: 'true',
                name: 'True',
                type: 'output',
                dataType: 'any',
                required: false,
                multiple: false,
            },
            {
                id: 'false',
                name: 'False',
                type: 'output',
                dataType: 'any',
                required: false,
                multiple: false,
            },
        ];
    }

    async execute(inputs: Map<string, unknown>, context: ExecutionContext): Promise<Map<string, unknown>> {
        this.setExecutionStatus('running');
        const outputs = new Map<string, unknown>();

        try {
            const value = inputs.get('value');
            const result = this.evaluate(value);

            context.logs.push({
                timestamp: new Date(),
                nodeId: this.id,
                level: 'debug',
                message: `Condition evaluated to: ${result}`,
                data: { value, operator: this.config.operator, compareValue: this.config.compareValue },
            });

            if (result) {
                outputs.set('true', value);
            } else {
                outputs.set('false', value);
            }

            this.setExecutionStatus('completed');
        } catch (error) {
            this.setExecutionStatus('failed');
            throw error;
        }

        return outputs;
    }

    private evaluate(value: unknown): boolean {
        const operator = this.config.operator as string;
        const compareValue = this.config.compareValue;

        switch (operator) {
            case 'equals':
                return value === compareValue;
            case 'notEquals':
                return value !== compareValue;
            case 'contains':
                return String(value).includes(String(compareValue));
            case 'startsWith':
                return String(value).startsWith(String(compareValue));
            case 'endsWith':
                return String(value).endsWith(String(compareValue));
            case 'greaterThan':
                return Number(value) > Number(compareValue);
            case 'lessThan':
                return Number(value) < Number(compareValue);
            case 'isEmpty':
                return value === null || value === undefined || value === '';
            case 'isNotEmpty':
                return value !== null && value !== undefined && value !== '';
            case 'matches':
                return new RegExp(String(compareValue)).test(String(value));
            case 'expression':
                return this.evaluateExpression(value);
            default:
                return false;
        }
    }

    private evaluateExpression(value: unknown): boolean {
        const expression = this.config.expression as string;
        if (!expression) return false;

        // Safe expression evaluation using Function constructor
        // In production, use a proper expression parser
        try {
            const fn = new Function('value', `return ${expression}`);
            return Boolean(fn(value));
        } catch {
            return false;
        }
    }

    validate(): ValidationError[] {
        const errors: ValidationError[] = [];

        if (!this.config.operator) {
            errors.push({
                nodeId: this.id,
                code: 'CONDITION_NO_OPERATOR',
                message: 'Condition node requires an operator',
            });
        }

        if (this.config.operator === 'expression' && !this.config.expression) {
            errors.push({
                nodeId: this.id,
                code: 'CONDITION_NO_EXPRESSION',
                message: 'Expression operator requires an expression',
            });
        }

        return errors;
    }
}

export class LoopNode extends WorkflowNode {
    constructor(data: Partial<WorkflowNodeData> = {}) {
        super({ ...data, type: 'loop' });
    }

    protected getDefaultName(): string {
        return 'Loop';
    }

    protected getDefaultConfig(): NodeConfig {
        return {
            loopType: 'forEach',
            maxIterations: 100,
            breakCondition: '',
            parallel: false,
            parallelLimit: 5,
        };
    }

    protected getDefaultInputPorts(): NodePort[] {
        return [
            {
                id: 'items',
                name: 'Items',
                type: 'input',
                dataType: 'array',
                required: true,
                multiple: false,
            },
        ];
    }

    protected getDefaultOutputPorts(): NodePort[] {
        return [
            {
                id: 'item',
                name: 'Current Item',
                type: 'output',
                dataType: 'any',
                required: false,
                multiple: false,
            },
            {
                id: 'index',
                name: 'Index',
                type: 'output',
                dataType: 'number',
                required: false,
                multiple: false,
            },
            {
                id: 'completed',
                name: 'Completed',
                type: 'output',
                dataType: 'array',
                required: false,
                multiple: false,
            },
        ];
    }

    async execute(inputs: Map<string, unknown>, context: ExecutionContext): Promise<Map<string, unknown>> {
        this.setExecutionStatus('running');
        const outputs = new Map<string, unknown>();

        try {
            const items = inputs.get('items') as unknown[];

            if (!Array.isArray(items)) {
                throw new Error('Loop input must be an array');
            }

            const maxIterations = this.config.maxIterations as number;
            const results: unknown[] = [];

            const iterationCount = Math.min(items.length, maxIterations);

            for (let i = 0; i < iterationCount; i++) {
                const item = items[i];

                context.logs.push({
                    timestamp: new Date(),
                    nodeId: this.id,
                    level: 'debug',
                    message: `Loop iteration ${i + 1}/${iterationCount}`,
                    data: { item },
                });

                // Check break condition
                if (this.config.breakCondition) {
                    try {
                        const fn = new Function('item', 'index', `return ${this.config.breakCondition}`);
                        if (fn(item, i)) {
                            context.logs.push({
                                timestamp: new Date(),
                                nodeId: this.id,
                                level: 'info',
                                message: 'Loop break condition met',
                            });
                            break;
                        }
                    } catch {
                        // Invalid break condition, continue
                    }
                }

                results.push({ item, index: i });
            }

            outputs.set('item', items[items.length - 1]);
            outputs.set('index', items.length - 1);
            outputs.set('completed', results);

            this.setExecutionStatus('completed');
        } catch (error) {
            this.setExecutionStatus('failed');
            throw error;
        }

        return outputs;
    }

    validate(): ValidationError[] {
        const errors: ValidationError[] = [];

        const maxIterations = this.config.maxIterations as number;
        if (maxIterations <= 0) {
            errors.push({
                nodeId: this.id,
                code: 'LOOP_INVALID_MAX_ITERATIONS',
                message: 'Max iterations must be greater than 0',
            });
        }

        if (maxIterations > 10000) {
            errors.push({
                nodeId: this.id,
                code: 'LOOP_MAX_ITERATIONS_TOO_HIGH',
                message: 'Max iterations cannot exceed 10000',
            });
        }

        return errors;
    }
}

export class APINode extends WorkflowNode {
    constructor(data: Partial<WorkflowNodeData> = {}) {
        super({ ...data, type: 'api' });
    }

    protected getDefaultName(): string {
        return 'API Call';
    }

    protected getDefaultConfig(): NodeConfig {
        return {
            url: '',
            method: 'GET',
            headers: {},
            body: '',
            bodyType: 'json',
            timeout: 30000,
            retryOnFailure: true,
            maxRetries: 3,
            retryDelay: 1000,
            validateStatus: true,
            followRedirects: true,
            auth: {
                type: 'none',
                credentials: {},
            },
        };
    }

    protected getDefaultInputPorts(): NodePort[] {
        return [
            {
                id: 'url',
                name: 'URL',
                type: 'input',
                dataType: 'string',
                required: false,
                multiple: false,
            },
            {
                id: 'body',
                name: 'Body',
                type: 'input',
                dataType: 'object',
                required: false,
                multiple: false,
            },
            {
                id: 'headers',
                name: 'Headers',
                type: 'input',
                dataType: 'object',
                required: false,
                multiple: false,
            },
        ];
    }

    protected getDefaultOutputPorts(): NodePort[] {
        return [
            {
                id: 'response',
                name: 'Response',
                type: 'output',
                dataType: 'object',
                required: false,
                multiple: false,
            },
            {
                id: 'status',
                name: 'Status',
                type: 'output',
                dataType: 'number',
                required: false,
                multiple: false,
            },
            {
                id: 'headers',
                name: 'Response Headers',
                type: 'output',
                dataType: 'object',
                required: false,
                multiple: false,
            },
        ];
    }

    async execute(inputs: Map<string, unknown>, context: ExecutionContext): Promise<Map<string, unknown>> {
        this.setExecutionStatus('running');
        const outputs = new Map<string, unknown>();

        try {
            const url = (inputs.get('url') as string) || (this.config.url as string);
            const inputBody = inputs.get('body');
            const inputHeaders = inputs.get('headers') as Record<string, string> | undefined;

            if (!url) {
                throw new Error('API URL is required');
            }

            const method = this.config.method as string;
            const timeout = this.config.timeout as number;
            const configHeaders = this.config.headers as Record<string, string>;

            const headers: Record<string, string> = {
                ...configHeaders,
                ...inputHeaders,
            };

            let body: string | undefined;
            if (inputBody && method !== 'GET') {
                body = typeof inputBody === 'string' ? inputBody : JSON.stringify(inputBody);
                if (!headers['Content-Type']) {
                    headers['Content-Type'] = 'application/json';
                }
            } else if (this.config.body && method !== 'GET') {
                body = this.config.body as string;
            }

            context.logs.push({
                timestamp: new Date(),
                nodeId: this.id,
                level: 'info',
                message: `Making ${method} request to ${url}`,
            });

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            try {
                const response = await fetch(url, {
                    method,
                    headers,
                    body,
                    signal: controller.signal,
                    redirect: this.config.followRedirects ? 'follow' : 'manual',
                });

                clearTimeout(timeoutId);

                const responseData = await this.parseResponse(response);

                outputs.set('response', responseData);
                outputs.set('status', response.status);
                outputs.set('headers', Object.fromEntries(response.headers.entries()));

                context.logs.push({
                    timestamp: new Date(),
                    nodeId: this.id,
                    level: 'info',
                    message: `API response received with status ${response.status}`,
                });

            } catch (error: unknown) {
                clearTimeout(timeoutId);
                throw error;
            }

            this.setExecutionStatus('completed');
        } catch (error) {
            this.setExecutionStatus('failed');
            throw error;
        }

        return outputs;
    }

    private async parseResponse(response: Response): Promise<unknown> {
        const contentType = response.headers.get('content-type') || '';

        if (contentType.includes('application/json')) {
            return response.json();
        } else if (contentType.includes('text/')) {
            return response.text();
        } else {
            return response.arrayBuffer();
        }
    }

    validate(): ValidationError[] {
        const errors: ValidationError[] = [];

        if (!this.config.url) {
            errors.push({
                nodeId: this.id,
                code: 'API_NO_URL',
                message: 'API node requires a URL',
            });
        }

        const validMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
        if (!validMethods.includes(this.config.method as string)) {
            errors.push({
                nodeId: this.id,
                code: 'API_INVALID_METHOD',
                message: `Invalid HTTP method: ${this.config.method}`,
            });
        }

        return errors;
    }
}

export class TransformNode extends WorkflowNode {
    constructor(data: Partial<WorkflowNodeData> = {}) {
        super({ ...data, type: 'transform' });
    }

    protected getDefaultName(): string {
        return 'Transform';
    }

    protected getDefaultConfig(): NodeConfig {
        return {
            transformType: 'jmespath',
            expression: '',
            customFunction: '',
            mapping: {},
        };
    }

    protected getDefaultInputPorts(): NodePort[] {
        return [
            {
                id: 'data',
                name: 'Data',
                type: 'input',
                dataType: 'any',
                required: true,
                multiple: false,
            },
        ];
    }

    protected getDefaultOutputPorts(): NodePort[] {
        return [
            {
                id: 'result',
                name: 'Result',
                type: 'output',
                dataType: 'any',
                required: false,
                multiple: false,
            },
        ];
    }

    async execute(inputs: Map<string, unknown>, context: ExecutionContext): Promise<Map<string, unknown>> {
        this.setExecutionStatus('running');
        const outputs = new Map<string, unknown>();

        try {
            const data = inputs.get('data');
            const transformType = this.config.transformType as string;

            let result: unknown;

            switch (transformType) {
                case 'jmespath':
                    result = this.applyJMESPath(data, this.config.expression as string);
                    break;
                case 'mapping':
                    result = this.applyMapping(data, this.config.mapping as Record<string, string>);
                    break;
                case 'custom':
                    result = this.applyCustomFunction(data, this.config.customFunction as string);
                    break;
                case 'stringify':
                    result = JSON.stringify(data, null, 2);
                    break;
                case 'parse':
                    result = typeof data === 'string' ? JSON.parse(data) : data;
                    break;
                case 'flatten':
                    result = Array.isArray(data) ? data.flat(Infinity) : data;
                    break;
                case 'unique':
                    result = Array.isArray(data) ? [...new Set(data)] : data;
                    break;
                case 'sort':
                    result = Array.isArray(data) ? [...data].sort() : data;
                    break;
                case 'reverse':
                    result = Array.isArray(data) ? [...data].reverse() : data;
                    break;
                case 'filter':
                    result = this.applyFilter(data, this.config.expression as string);
                    break;
                case 'map':
                    result = this.applyMap(data, this.config.expression as string);
                    break;
                case 'reduce':
                    result = this.applyReduce(data, this.config.expression as string);
                    break;
                default:
                    result = data;
            }

            outputs.set('result', result);

            context.logs.push({
                timestamp: new Date(),
                nodeId: this.id,
                level: 'debug',
                message: `Transform applied: ${transformType}`,
                data: { inputType: typeof data, outputType: typeof result },
            });

            this.setExecutionStatus('completed');
        } catch (error) {
            this.setExecutionStatus('failed');
            throw error;
        }

        return outputs;
    }

    private applyJMESPath(data: unknown, expression: string): unknown {
        // Simplified JMESPath-like implementation
        if (!expression) return data;

        const parts = expression.split('.');
        let current: unknown = data;

        for (const part of parts) {
            if (current === null || current === undefined) return null;

            const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
            if (arrayMatch) {
                const [, key, index] = arrayMatch;
                current = (current as Record<string, unknown>)[key!];
                if (Array.isArray(current)) {
                    current = current[parseInt(index!, 10)];
                }
            } else if (part === '*' && Array.isArray(current)) {
                return current;
            } else {
                current = (current as Record<string, unknown>)[part];
            }
        }

        return current;
    }

    private applyMapping(data: unknown, mapping: Record<string, string>): unknown {
        if (typeof data !== 'object' || data === null) return data;

        const result: Record<string, unknown> = {};
        for (const [newKey, oldKey] of Object.entries(mapping)) {
            result[newKey] = this.applyJMESPath(data, oldKey);
        }
        return result;
    }

    private applyCustomFunction(data: unknown, fnString: string): unknown {
        if (!fnString) return data;

        try {
            const fn = new Function('data', `return ${fnString}`);
            return fn(data);
        } catch (error) {
            throw new Error(`Custom function error: ${error}`);
        }
    }

    private applyFilter(data: unknown, expression: string): unknown {
        if (!Array.isArray(data)) return data;

        try {
            const fn = new Function('item', 'index', `return ${expression}`);
            return data.filter((item, index) => fn(item, index));
        } catch {
            return data;
        }
    }

    private applyMap(data: unknown, expression: string): unknown {
        if (!Array.isArray(data)) return data;

        try {
            const fn = new Function('item', 'index', `return ${expression}`);
            return data.map((item, index) => fn(item, index));
        } catch {
            return data;
        }
    }

    private applyReduce(data: unknown, expression: string): unknown {
        if (!Array.isArray(data)) return data;

        try {
            const fn = new Function('acc', 'item', 'index', `return ${expression}`);
            return data.reduce((acc, item, index) => fn(acc, item, index), null);
        } catch {
            return data;
        }
    }

    validate(): ValidationError[] {
        const errors: ValidationError[] = [];

        const transformType = this.config.transformType as string;
        const needsExpression = ['jmespath', 'custom', 'filter', 'map', 'reduce'];

        if (needsExpression.includes(transformType) && !this.config.expression && !this.config.customFunction) {
            errors.push({
                nodeId: this.id,
                code: 'TRANSFORM_NO_EXPRESSION',
                message: `Transform type '${transformType}' requires an expression`,
            });
        }

        return errors;
    }
}

export class InputNode extends WorkflowNode {
    constructor(data: Partial<WorkflowNodeData> = {}) {
        super({ ...data, type: 'input' });
    }

    protected getDefaultName(): string {
        return 'Input';
    }

    protected getDefaultConfig(): NodeConfig {
        return {
            inputType: 'text',
            defaultValue: '',
            required: true,
            schema: {},
        };
    }

    protected getDefaultInputPorts(): NodePort[] {
        return [];
    }

    protected getDefaultOutputPorts(): NodePort[] {
        return [
            {
                id: 'value',
                name: 'Value',
                type: 'output',
                dataType: 'any',
                required: false,
                multiple: false,
            },
        ];
    }

    async execute(inputs: Map<string, unknown>, context: ExecutionContext): Promise<Map<string, unknown>> {
        this.setExecutionStatus('running');
        const outputs = new Map<string, unknown>();

        try {
            // Get input from workflow variables or use default
            const inputKey = this.config.inputKey as string || this.id;
            const value = context.variables.get(inputKey) ?? this.config.defaultValue;

            outputs.set('value', value);

            context.logs.push({
                timestamp: new Date(),
                nodeId: this.id,
                level: 'debug',
                message: 'Input node value retrieved',
                data: { inputKey, hasValue: value !== undefined },
            });

            this.setExecutionStatus('completed');
        } catch (error) {
            this.setExecutionStatus('failed');
            throw error;
        }

        return outputs;
    }

    validate(): ValidationError[] {
        return [];
    }
}

export class OutputNode extends WorkflowNode {
    constructor(data: Partial<WorkflowNodeData> = {}) {
        super({ ...data, type: 'output' });
    }

    protected getDefaultName(): string {
        return 'Output';
    }

    protected getDefaultConfig(): NodeConfig {
        return {
            outputKey: 'result',
            format: 'raw',
        };
    }

    protected getDefaultInputPorts(): NodePort[] {
        return [
            {
                id: 'value',
                name: 'Value',
                type: 'input',
                dataType: 'any',
                required: true,
                multiple: false,
            },
        ];
    }

    protected getDefaultOutputPorts(): NodePort[] {
        return [];
    }

    async execute(inputs: Map<string, unknown>, context: ExecutionContext): Promise<Map<string, unknown>> {
        this.setExecutionStatus('running');
        const outputs = new Map<string, unknown>();

        try {
            const value = inputs.get('value');
            const outputKey = this.config.outputKey as string;

            // Store in workflow context
            context.nodeOutputs.set(outputKey, value);

            context.logs.push({
                timestamp: new Date(),
                nodeId: this.id,
                level: 'info',
                message: `Output stored: ${outputKey}`,
                data: { outputKey, valueType: typeof value },
            });

            this.setExecutionStatus('completed');
        } catch (error) {
            this.setExecutionStatus('failed');
            throw error;
        }

        return outputs;
    }

    validate(): ValidationError[] {
        const errors: ValidationError[] = [];

        if (!this.config.outputKey) {
            errors.push({
                nodeId: this.id,
                code: 'OUTPUT_NO_KEY',
                message: 'Output node requires an output key',
            });
        }

        return errors;
    }
}

export class MergeNode extends WorkflowNode {
    constructor(data: Partial<WorkflowNodeData> = {}) {
        super({ ...data, type: 'merge' });
    }

    protected getDefaultName(): string {
        return 'Merge';
    }

    protected getDefaultConfig(): NodeConfig {
        return {
            mergeStrategy: 'concat',
            waitForAll: true,
        };
    }

    protected getDefaultInputPorts(): NodePort[] {
        return [
            {
                id: 'input1',
                name: 'Input 1',
                type: 'input',
                dataType: 'any',
                required: true,
                multiple: false,
            },
            {
                id: 'input2',
                name: 'Input 2',
                type: 'input',
                dataType: 'any',
                required: true,
                multiple: false,
            },
        ];
    }

    protected getDefaultOutputPorts(): NodePort[] {
        return [
            {
                id: 'merged',
                name: 'Merged',
                type: 'output',
                dataType: 'any',
                required: false,
                multiple: false,
            },
        ];
    }

    async execute(inputs: Map<string, unknown>, context: ExecutionContext): Promise<Map<string, unknown>> {
        this.setExecutionStatus('running');
        const outputs = new Map<string, unknown>();

        try {
            const input1 = inputs.get('input1');
            const input2 = inputs.get('input2');
            const strategy = this.config.mergeStrategy as string;

            let merged: unknown;

            switch (strategy) {
                case 'concat':
                    if (Array.isArray(input1) && Array.isArray(input2)) {
                        merged = [...input1, ...input2];
                    } else {
                        merged = [input1, input2];
                    }
                    break;
                case 'object':
                    merged = { ...input1 as object, ...input2 as object };
                    break;
                case 'first':
                    merged = input1 ?? input2;
                    break;
                case 'last':
                    merged = input2 ?? input1;
                    break;
                default:
                    merged = [input1, input2];
            }

            outputs.set('merged', merged);

            context.logs.push({
                timestamp: new Date(),
                nodeId: this.id,
                level: 'debug',
                message: `Merged using strategy: ${strategy}`,
            });

            this.setExecutionStatus('completed');
        } catch (error) {
            this.setExecutionStatus('failed');
            throw error;
        }

        return outputs;
    }

    validate(): ValidationError[] {
        return [];
    }
}

export class SplitNode extends WorkflowNode {
    constructor(data: Partial<WorkflowNodeData> = {}) {
        super({ ...data, type: 'split' });
    }

    protected getDefaultName(): string {
        return 'Split';
    }

    protected getDefaultConfig(): NodeConfig {
        return {
            splitType: 'array',
            chunkSize: 1,
        };
    }

    protected getDefaultInputPorts(): NodePort[] {
        return [
            {
                id: 'data',
                name: 'Data',
                type: 'input',
                dataType: 'any',
                required: true,
                multiple: false,
            },
        ];
    }

    protected getDefaultOutputPorts(): NodePort[] {
        return [
            {
                id: 'items',
                name: 'Items',
                type: 'output',
                dataType: 'array',
                required: false,
                multiple: false,
            },
        ];
    }

    async execute(inputs: Map<string, unknown>, context: ExecutionContext): Promise<Map<string, unknown>> {
        this.setExecutionStatus('running');
        const outputs = new Map<string, unknown>();

        try {
            const data = inputs.get('data');
            const splitType = this.config.splitType as string;

            let items: unknown[];

            switch (splitType) {
                case 'array':
                    items = Array.isArray(data) ? data : [data];
                    break;
                case 'string':
                    if (typeof data === 'string') {
                        const delimiter = this.config.delimiter as string || '\n';
                        items = data.split(delimiter);
                    } else {
                        items = [data];
                    }
                    break;
                case 'chunks':
                    if (Array.isArray(data)) {
                        const chunkSize = this.config.chunkSize as number || 1;
                        items = [];
                        for (let i = 0; i < data.length; i += chunkSize) {
                            items.push(data.slice(i, i + chunkSize));
                        }
                    } else {
                        items = [data];
                    }
                    break;
                case 'object':
                    if (typeof data === 'object' && data !== null) {
                        items = Object.entries(data).map(([key, value]) => ({ key, value }));
                    } else {
                        items = [data];
                    }
                    break;
                default:
                    items = Array.isArray(data) ? data : [data];
            }

            outputs.set('items', items);

            context.logs.push({
                timestamp: new Date(),
                nodeId: this.id,
                level: 'debug',
                message: `Split into ${items.length} items`,
            });

            this.setExecutionStatus('completed');
        } catch (error) {
            this.setExecutionStatus('failed');
            throw error;
        }

        return outputs;
    }

    validate(): ValidationError[] {
        return [];
    }
}

export class DelayNode extends WorkflowNode {
    constructor(data: Partial<WorkflowNodeData> = {}) {
        super({ ...data, type: 'delay' });
    }

    protected getDefaultName(): string {
        return 'Delay';
    }

    protected getDefaultConfig(): NodeConfig {
        return {
            delayMs: 1000,
            delayType: 'fixed',
        };
    }

    protected getDefaultInputPorts(): NodePort[] {
        return [
            {
                id: 'passthrough',
                name: 'Pass Through',
                type: 'input',
                dataType: 'any',
                required: false,
                multiple: false,
            },
        ];
    }

    protected getDefaultOutputPorts(): NodePort[] {
        return [
            {
                id: 'passthrough',
                name: 'Pass Through',
                type: 'output',
                dataType: 'any',
                required: false,
                multiple: false,
            },
        ];
    }

    async execute(inputs: Map<string, unknown>, context: ExecutionContext): Promise<Map<string, unknown>> {
        this.setExecutionStatus('running');
        const outputs = new Map<string, unknown>();

        try {
            const delayMs = this.config.delayMs as number;
            const passthrough = inputs.get('passthrough');

            context.logs.push({
                timestamp: new Date(),
                nodeId: this.id,
                level: 'debug',
                message: `Delaying for ${delayMs}ms`,
            });

            await new Promise(resolve => setTimeout(resolve, delayMs));

            outputs.set('passthrough', passthrough);

            this.setExecutionStatus('completed');
        } catch (error) {
            this.setExecutionStatus('failed');
            throw error;
        }

        return outputs;
    }

    validate(): ValidationError[] {
        const errors: ValidationError[] = [];

        const delayMs = this.config.delayMs as number;
        if (delayMs < 0) {
            errors.push({
                nodeId: this.id,
                code: 'DELAY_NEGATIVE',
                message: 'Delay cannot be negative',
            });
        }

        if (delayMs > 3600000) {
            errors.push({
                nodeId: this.id,
                code: 'DELAY_TOO_LONG',
                message: 'Delay cannot exceed 1 hour (3600000ms)',
            });
        }

        return errors;
    }
}

export class WebhookNode extends WorkflowNode {
    constructor(data: Partial<WorkflowNodeData> = {}) {
        super({ ...data, type: 'webhook' });
    }

    protected getDefaultName(): string {
        return 'Webhook';
    }

    protected getDefaultConfig(): NodeConfig {
        return {
            webhookId: randomUUID(),
            path: '/webhook',
            method: 'POST',
            responseType: 'json',
            authentication: 'none',
        };
    }

    protected getDefaultInputPorts(): NodePort[] {
        return [];
    }

    protected getDefaultOutputPorts(): NodePort[] {
        return [
            {
                id: 'body',
                name: 'Body',
                type: 'output',
                dataType: 'object',
                required: false,
                multiple: false,
            },
            {
                id: 'headers',
                name: 'Headers',
                type: 'output',
                dataType: 'object',
                required: false,
                multiple: false,
            },
            {
                id: 'query',
                name: 'Query Params',
                type: 'output',
                dataType: 'object',
                required: false,
                multiple: false,
            },
        ];
    }

    async execute(inputs: Map<string, unknown>, context: ExecutionContext): Promise<Map<string, unknown>> {
        this.setExecutionStatus('running');
        const outputs = new Map<string, unknown>();

        try {
            // Webhook nodes are trigger nodes - data comes from external HTTP request
            // The webhook data should be in the context variables
            const webhookData = context.variables.get(`webhook_${this.id}`) as Record<string, unknown> | undefined;

            if (webhookData) {
                outputs.set('body', webhookData.body);
                outputs.set('headers', webhookData.headers);
                outputs.set('query', webhookData.query);
            }

            context.logs.push({
                timestamp: new Date(),
                nodeId: this.id,
                level: 'info',
                message: 'Webhook triggered',
                data: webhookData,
            });

            this.setExecutionStatus('completed');
        } catch (error) {
            this.setExecutionStatus('failed');
            throw error;
        }

        return outputs;
    }

    validate(): ValidationError[] {
        return [];
    }
}

// ============================================================================
// Node Factory
// ============================================================================

export class NodeFactory {
    private static nodeTypes: Map<NodeType, new (data?: Partial<WorkflowNodeData>) => WorkflowNode> = new Map([
        ['llm', LLMNode],
        ['condition', ConditionNode],
        ['loop', LoopNode],
        ['api', APINode],
        ['transform', TransformNode],
        ['input', InputNode],
        ['output', OutputNode],
        ['merge', MergeNode],
        ['split', SplitNode],
        ['delay', DelayNode],
        ['webhook', WebhookNode],
    ]);

    static createNode(type: NodeType, data?: Partial<WorkflowNodeData>): WorkflowNode {
        const NodeClass = this.nodeTypes.get(type);
        if (!NodeClass) {
            throw new Error(`Unknown node type: ${type}`);
        }
        return new NodeClass(data);
    }

    static registerNodeType(type: NodeType, nodeClass: new (data?: Partial<WorkflowNodeData>) => WorkflowNode): void {
        this.nodeTypes.set(type, nodeClass);
    }

    static getAvailableNodeTypes(): NodeType[] {
        return Array.from(this.nodeTypes.keys());
    }
}

// ============================================================================
// WorkflowGraph
// ============================================================================

export class WorkflowGraph {
    private nodes: Map<string, WorkflowNode> = new Map();
    private connections: Map<string, NodeConnection> = new Map();
    private adjacencyList: Map<string, Set<string>> = new Map();
    private reverseAdjacencyList: Map<string, Set<string>> = new Map();

    addNode(node: WorkflowNode): void {
        this.nodes.set(node.id, node);
        this.adjacencyList.set(node.id, new Set());
        this.reverseAdjacencyList.set(node.id, new Set());
    }

    removeNode(nodeId: string): void {
        // Remove all connections involving this node
        const connectionsToRemove: string[] = [];
        for (const [connId, conn] of this.connections) {
            if (conn.sourceNodeId === nodeId || conn.targetNodeId === nodeId) {
                connectionsToRemove.push(connId);
            }
        }
        connectionsToRemove.forEach(id => this.removeConnection(id));

        // Remove from adjacency lists
        this.adjacencyList.delete(nodeId);
        this.reverseAdjacencyList.delete(nodeId);

        // Remove from other nodes' adjacency lists
        for (const [, neighbors] of this.adjacencyList) {
            neighbors.delete(nodeId);
        }
        for (const [, neighbors] of this.reverseAdjacencyList) {
            neighbors.delete(nodeId);
        }

        this.nodes.delete(nodeId);
    }

    addConnection(connection: NodeConnection): void {
        if (!this.nodes.has(connection.sourceNodeId)) {
            throw new Error(`Source node ${connection.sourceNodeId} not found`);
        }
        if (!this.nodes.has(connection.targetNodeId)) {
            throw new Error(`Target node ${connection.targetNodeId} not found`);
        }

        // Check for cycles
        if (this.wouldCreateCycle(connection.sourceNodeId, connection.targetNodeId)) {
            throw new Error('Connection would create a cycle');
        }

        this.connections.set(connection.id, connection);
        this.adjacencyList.get(connection.sourceNodeId)?.add(connection.targetNodeId);
        this.reverseAdjacencyList.get(connection.targetNodeId)?.add(connection.sourceNodeId);
    }

    removeConnection(connectionId: string): void {
        const connection = this.connections.get(connectionId);
        if (connection) {
            this.adjacencyList.get(connection.sourceNodeId)?.delete(connection.targetNodeId);
            this.reverseAdjacencyList.get(connection.targetNodeId)?.delete(connection.sourceNodeId);
            this.connections.delete(connectionId);
        }
    }

    getNode(nodeId: string): WorkflowNode | undefined {
        return this.nodes.get(nodeId);
    }

    getNodes(): WorkflowNode[] {
        return Array.from(this.nodes.values());
    }

    getConnections(): NodeConnection[] {
        return Array.from(this.connections.values());
    }

    getConnectionsFromNode(nodeId: string): NodeConnection[] {
        return this.getConnections().filter(c => c.sourceNodeId === nodeId);
    }

    getConnectionsToNode(nodeId: string): NodeConnection[] {
        return this.getConnections().filter(c => c.targetNodeId === nodeId);
    }

    getInputNodes(): WorkflowNode[] {
        return this.getNodes().filter(node =>
            node.type === 'input' || node.type === 'webhook' ||
            (this.reverseAdjacencyList.get(node.id)?.size ?? 0) === 0
        );
    }

    getOutputNodes(): WorkflowNode[] {
        return this.getNodes().filter(node =>
            node.type === 'output' ||
            (this.adjacencyList.get(node.id)?.size ?? 0) === 0
        );
    }

    private wouldCreateCycle(sourceId: string, targetId: string): boolean {
        // DFS to check if there's a path from target to source
        const visited = new Set<string>();
        const stack = [targetId];

        while (stack.length > 0) {
            const current = stack.pop()!;
            if (current === sourceId) return true;
            if (visited.has(current)) continue;
            visited.add(current);

            const neighbors = this.adjacencyList.get(current);
            if (neighbors) {
                for (const neighbor of neighbors) {
                    stack.push(neighbor);
                }
            }
        }

        return false;
    }

    topologicalSort(): string[] {
        const visited = new Set<string>();
        const result: string[] = [];

        const visit = (nodeId: string) => {
            if (visited.has(nodeId)) return;
            visited.add(nodeId);

            const neighbors = this.adjacencyList.get(nodeId);
            if (neighbors) {
                for (const neighbor of neighbors) {
                    visit(neighbor);
                }
            }

            result.unshift(nodeId);
        };

        for (const nodeId of this.nodes.keys()) {
            visit(nodeId);
        }

        return result;
    }

    clear(): void {
        this.nodes.clear();
        this.connections.clear();
        this.adjacencyList.clear();
        this.reverseAdjacencyList.clear();
    }

    toData(): { nodes: WorkflowNodeData[]; connections: NodeConnection[] } {
        return {
            nodes: this.getNodes().map(n => n.toData()),
            connections: this.getConnections(),
        };
    }

    static fromData(data: { nodes: WorkflowNodeData[]; connections: NodeConnection[] }): WorkflowGraph {
        const graph = new WorkflowGraph();

        for (const nodeData of data.nodes) {
            const node = NodeFactory.createNode(nodeData.type, nodeData);
            graph.addNode(node);
        }

        for (const connection of data.connections) {
            graph.addConnection(connection);
        }

        return graph;
    }
}

// ============================================================================
// ValidationEngine
// ============================================================================

export class ValidationEngine {
    validate(graph: WorkflowGraph): ValidationResult {
        const errors: ValidationError[] = [];
        const warnings: ValidationWarning[] = [];

        // Validate individual nodes
        for (const node of graph.getNodes()) {
            errors.push(...node.validate());
        }

        // Validate graph structure
        this.validateGraphStructure(graph, errors, warnings);

        // Validate connections
        this.validateConnections(graph, errors, warnings);

        // Validate data flow
        this.validateDataFlow(graph, errors, warnings);

        return {
            valid: errors.length === 0,
            errors,
            warnings,
        };
    }

    private validateGraphStructure(graph: WorkflowGraph, errors: ValidationError[], warnings: ValidationWarning[]): void {
        const nodes = graph.getNodes();

        if (nodes.length === 0) {
            errors.push({
                code: 'EMPTY_WORKFLOW',
                message: 'Workflow has no nodes',
            });
            return;
        }

        // Check for input nodes
        const inputNodes = graph.getInputNodes();
        if (inputNodes.length === 0) {
            warnings.push({
                code: 'NO_INPUT_NODES',
                message: 'Workflow has no input or trigger nodes',
            });
        }

        // Check for output nodes
        const outputNodes = graph.getOutputNodes();
        if (outputNodes.length === 0) {
            warnings.push({
                code: 'NO_OUTPUT_NODES',
                message: 'Workflow has no output nodes',
            });
        }

        // Check for disconnected nodes
        const connections = graph.getConnections();
        const connectedNodes = new Set<string>();
        for (const conn of connections) {
            connectedNodes.add(conn.sourceNodeId);
            connectedNodes.add(conn.targetNodeId);
        }

        for (const node of nodes) {
            if (!connectedNodes.has(node.id) && nodes.length > 1) {
                warnings.push({
                    nodeId: node.id,
                    code: 'DISCONNECTED_NODE',
                    message: `Node "${node.name}" is not connected to any other node`,
                });
            }
        }
    }

    private validateConnections(graph: WorkflowGraph, errors: ValidationError[], warnings: ValidationWarning[]): void {
        for (const connection of graph.getConnections()) {
            const sourceNode = graph.getNode(connection.sourceNodeId);
            const targetNode = graph.getNode(connection.targetNodeId);

            if (!sourceNode) {
                errors.push({
                    connectionId: connection.id,
                    code: 'INVALID_SOURCE_NODE',
                    message: `Connection references non-existent source node: ${connection.sourceNodeId}`,
                });
                continue;
            }

            if (!targetNode) {
                errors.push({
                    connectionId: connection.id,
                    code: 'INVALID_TARGET_NODE',
                    message: `Connection references non-existent target node: ${connection.targetNodeId}`,
                });
                continue;
            }

            // Validate port existence
            const sourcePort = sourceNode.outputPorts.find(p => p.id === connection.sourcePortId);
            const targetPort = targetNode.inputPorts.find(p => p.id === connection.targetPortId);

            if (!sourcePort) {
                errors.push({
                    connectionId: connection.id,
                    code: 'INVALID_SOURCE_PORT',
                    message: `Source port ${connection.sourcePortId} not found on node ${sourceNode.name}`,
                });
            }

            if (!targetPort) {
                errors.push({
                    connectionId: connection.id,
                    code: 'INVALID_TARGET_PORT',
                    message: `Target port ${connection.targetPortId} not found on node ${targetNode.name}`,
                });
            }

            // Type compatibility warning
            if (sourcePort && targetPort && sourcePort.dataType !== 'any' && targetPort.dataType !== 'any') {
                if (sourcePort.dataType !== targetPort.dataType) {
                    warnings.push({
                        nodeId: connection.targetNodeId,
                        code: 'TYPE_MISMATCH',
                        message: `Type mismatch: ${sourcePort.dataType} -> ${targetPort.dataType}`,
                    });
                }
            }
        }
    }

    private validateDataFlow(graph: WorkflowGraph, errors: ValidationError[], warnings: ValidationWarning[]): void {
        // Check required input ports have connections
        for (const node of graph.getNodes()) {
            const incomingConnections = graph.getConnectionsToNode(node.id);

            for (const port of node.inputPorts) {
                if (port.required) {
                    const hasConnection = incomingConnections.some(c => c.targetPortId === port.id);
                    if (!hasConnection && node.type !== 'input' && node.type !== 'webhook') {
                        errors.push({
                            nodeId: node.id,
                            code: 'REQUIRED_PORT_UNCONNECTED',
                            message: `Required input port "${port.name}" on node "${node.name}" has no connection`,
                        });
                    }
                }
            }
        }
    }
}

// ============================================================================
// WorkflowExecutor
// ============================================================================

export class WorkflowExecutor {
    private abortController: AbortController | null = null;

    async execute(
        graph: WorkflowGraph,
        inputs: Record<string, unknown> = {},
        options: { timeout?: number; onProgress?: (progress: ExecutionProgress) => void } = {}
    ): Promise<ExecutionResult> {
        const executionId = randomUUID();
        const startTime = new Date();

        const context: ExecutionContext = {
            workflowId: randomUUID(),
            executionId,
            variables: new Map(Object.entries(inputs)),
            nodeOutputs: new Map(),
            currentNodeId: null,
            status: 'executing',
            startTime,
            logs: [],
        };

        this.abortController = new AbortController();

        try {
            // Validate first
            const validation = new ValidationEngine().validate(graph);
            if (!validation.valid) {
                throw new Error(`Workflow validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
            }

            // Get execution order
            const executionOrder = graph.topologicalSort();
            const totalNodes = executionOrder.length;

            // Execute nodes in order
            for (let i = 0; i < executionOrder.length; i++) {
                if (this.abortController.signal.aborted) {
                    throw new Error('Execution aborted');
                }

                const nodeId = executionOrder[i]!;
                const node = graph.getNode(nodeId);
                if (!node) continue;

                context.currentNodeId = nodeId;

                // Gather inputs from connected nodes
                const nodeInputs = this.gatherNodeInputs(graph, nodeId, context);

                context.logs.push({
                    timestamp: new Date(),
                    nodeId,
                    level: 'info',
                    message: `Executing node: ${node.name}`,
                });

                // Execute node
                const outputs = await node.execute(nodeInputs, context);

                // Store outputs
                context.nodeOutputs.set(nodeId, Object.fromEntries(outputs));

                // Report progress
                if (options.onProgress) {
                    options.onProgress({
                        executionId,
                        currentNodeId: nodeId,
                        completedNodes: i + 1,
                        totalNodes,
                        percentage: Math.round(((i + 1) / totalNodes) * 100),
                    });
                }
            }

            context.status = 'completed';
            context.endTime = new Date();

            return {
                success: true,
                executionId,
                outputs: Object.fromEntries(context.nodeOutputs),
                logs: context.logs,
                duration: context.endTime.getTime() - startTime.getTime(),
            };

        } catch (error) {
            context.status = 'failed';
            context.endTime = new Date();
            context.error = error as Error;

            return {
                success: false,
                executionId,
                error: (error as Error).message,
                outputs: Object.fromEntries(context.nodeOutputs),
                logs: context.logs,
                duration: (context.endTime?.getTime() || Date.now()) - startTime.getTime(),
            };
        }
    }

    abort(): void {
        this.abortController?.abort();
    }

    private gatherNodeInputs(graph: WorkflowGraph, nodeId: string, context: ExecutionContext): Map<string, unknown> {
        const inputs = new Map<string, unknown>();
        const connections = graph.getConnectionsToNode(nodeId);

        for (const conn of connections) {
            const sourceOutputs = context.nodeOutputs.get(conn.sourceNodeId) as Record<string, unknown> | undefined;
            if (sourceOutputs) {
                const value = sourceOutputs[conn.sourcePortId];
                inputs.set(conn.targetPortId, value);
            }
        }

        return inputs;
    }
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

// ============================================================================
// WorkflowCompiler
// ============================================================================

export class WorkflowCompiler {
    compile(workflow: WorkflowData, language: 'typescript' | 'python' | 'json' = 'typescript'): CompiledWorkflow {
        const graph = WorkflowGraph.fromData(workflow);

        let code: string;
        const dependencies: string[] = [];

        switch (language) {
            case 'typescript':
                code = this.compileToTypeScript(graph, workflow);
                dependencies.push('@types/node', 'typescript');
                break;
            case 'python':
                code = this.compileToPython(graph, workflow);
                dependencies.push('requests', 'openai');
                break;
            case 'json':
                code = JSON.stringify(workflow, null, 2);
                break;
            default:
                throw new Error(`Unsupported language: ${language}`);
        }

        return {
            id: randomUUID(),
            sourceWorkflowId: workflow.id,
            code,
            language,
            dependencies,
            compiledAt: new Date(),
            checksum: this.calculateChecksum(code),
        };
    }

    private compileToTypeScript(graph: WorkflowGraph, workflow: WorkflowData): string {
        const executionOrder = graph.topologicalSort();
        const lines: string[] = [
            '/**',
            ` * Auto-generated workflow: ${workflow.name}`,
            ` * Generated at: ${new Date().toISOString()}`,
            ' */',
            '',
            'import { MagicCanvas, NodeFactory, WorkflowGraph } from "./MagicCanvas";',
            '',
            `export async function executeWorkflow(inputs: Record<string, unknown> = {}): Promise<Record<string, unknown>> {`,
            '  const canvas = new MagicCanvas();',
            '  const workflow = canvas.createWorkflow({',
            `    name: "${workflow.name}",`,
            `    description: "${workflow.description}",`,
            '  });',
            '',
        ];

        // Add nodes
        for (const nodeData of workflow.nodes) {
            lines.push(`  // Node: ${nodeData.name}`);
            lines.push(`  const node_${this.sanitizeId(nodeData.id)} = NodeFactory.createNode("${nodeData.type}", ${JSON.stringify(nodeData, null, 4).split('\n').map((l, i) => i === 0 ? l : '  ' + l).join('\n')});`);
            lines.push(`  workflow.addNode(node_${this.sanitizeId(nodeData.id)});`);
            lines.push('');
        }

        // Add connections
        lines.push('  // Connections');
        for (const conn of workflow.connections) {
            lines.push(`  workflow.addConnection(${JSON.stringify(conn)});`);
        }
        lines.push('');

        // Execute
        lines.push('  // Execute workflow');
        lines.push('  const result = await canvas.executeWorkflow(workflow, inputs);');
        lines.push('  return result.outputs;');
        lines.push('}');
        lines.push('');

        // Add standalone execution
        lines.push('// Run standalone');
        lines.push('if (require.main === module) {');
        lines.push('  executeWorkflow().then(console.log).catch(console.error);');
        lines.push('}');

        return lines.join('\n');
    }

    private compileToPython(graph: WorkflowGraph, workflow: WorkflowData): string {
        const executionOrder = graph.topologicalSort();
        const lines: string[] = [
            '"""',
            `Auto-generated workflow: ${workflow.name}`,
            `Generated at: ${new Date().toISOString()}`,
            '"""',
            '',
            'import json',
            'import requests',
            'from typing import Dict, Any, Optional',
            '',
            '',
            'class WorkflowExecutor:',
            '    def __init__(self):',
            '        self.node_outputs: Dict[str, Any] = {}',
            '',
            '    def execute(self, inputs: Dict[str, Any] = None) -> Dict[str, Any]:',
            '        inputs = inputs or {}',
            '',
        ];

        // Generate node execution code
        for (const nodeId of executionOrder) {
            const nodeData = workflow.nodes.find(n => n.id === nodeId);
            if (!nodeData) continue;

            lines.push(`        # Node: ${nodeData.name}`);
            lines.push(`        self.node_outputs["${nodeId}"] = self._execute_${nodeData.type}_node(`);
            lines.push(`            config=${JSON.stringify(nodeData.config)},`);
            lines.push(`            inputs=self._gather_inputs("${nodeId}", ${JSON.stringify(workflow.connections.filter(c => c.targetNodeId === nodeId))})`);
            lines.push('        )');
            lines.push('');
        }

        lines.push('        return self.node_outputs');
        lines.push('');

        // Add helper methods
        lines.push('    def _gather_inputs(self, node_id: str, connections: list) -> Dict[str, Any]:');
        lines.push('        inputs = {}');
        lines.push('        for conn in connections:');
        lines.push('            if conn["targetNodeId"] == node_id:');
        lines.push('                source_outputs = self.node_outputs.get(conn["sourceNodeId"], {})');
        lines.push('                if isinstance(source_outputs, dict):');
        lines.push('                    inputs[conn["targetPortId"]] = source_outputs.get(conn["sourcePortId"])');
        lines.push('        return inputs');
        lines.push('');

        // Add node type executors
        const nodeTypes = new Set(workflow.nodes.map(n => n.type));
        for (const nodeType of nodeTypes) {
            lines.push(...this.generatePythonNodeExecutor(nodeType));
        }

        // Main execution
        lines.push('');
        lines.push('if __name__ == "__main__":');
        lines.push('    executor = WorkflowExecutor()');
        lines.push('    result = executor.execute()');
        lines.push('    print(json.dumps(result, indent=2, default=str))');

        return lines.join('\n');
    }

    private generatePythonNodeExecutor(nodeType: string): string[] {
        const lines: string[] = [];

        switch (nodeType) {
            case 'llm':
                lines.push('    def _execute_llm_node(self, config: dict, inputs: dict) -> dict:');
                lines.push('        # Placeholder for LLM integration');
                lines.push('        prompt = inputs.get("prompt", "")');
                lines.push('        return {"response": f"[LLM Response for: {prompt}]", "metadata": {}}');
                lines.push('');
                break;
            case 'api':
                lines.push('    def _execute_api_node(self, config: dict, inputs: dict) -> dict:');
                lines.push('        url = inputs.get("url") or config.get("url", "")');
                lines.push('        method = config.get("method", "GET")');
                lines.push('        headers = {**config.get("headers", {}), **inputs.get("headers", {})}');
                lines.push('        body = inputs.get("body") or config.get("body")');
                lines.push('        response = requests.request(method, url, headers=headers, json=body)');
                lines.push('        return {"response": response.json() if response.headers.get("content-type", "").startswith("application/json") else response.text, "status": response.status_code}');
                lines.push('');
                break;
            case 'condition':
                lines.push('    def _execute_condition_node(self, config: dict, inputs: dict) -> dict:');
                lines.push('        value = inputs.get("value")');
                lines.push('        operator = config.get("operator", "equals")');
                lines.push('        compare_value = config.get("compareValue")');
                lines.push('        result = self._evaluate_condition(value, operator, compare_value)');
                lines.push('        return {"true": value, "false": value} if result else {"false": value}');
                lines.push('');
                lines.push('    def _evaluate_condition(self, value, operator, compare_value) -> bool:');
                lines.push('        if operator == "equals": return value == compare_value');
                lines.push('        if operator == "notEquals": return value != compare_value');
                lines.push('        if operator == "contains": return str(compare_value) in str(value)');
                lines.push('        return False');
                lines.push('');
                break;
            case 'transform':
                lines.push('    def _execute_transform_node(self, config: dict, inputs: dict) -> dict:');
                lines.push('        data = inputs.get("data")');
                lines.push('        transform_type = config.get("transformType", "stringify")');
                lines.push('        if transform_type == "stringify": return {"result": json.dumps(data)}');
                lines.push('        if transform_type == "parse" and isinstance(data, str): return {"result": json.loads(data)}');
                lines.push('        return {"result": data}');
                lines.push('');
                break;
            case 'loop':
                lines.push('    def _execute_loop_node(self, config: dict, inputs: dict) -> dict:');
                lines.push('        items = inputs.get("items", [])');
                lines.push('        max_iterations = config.get("maxIterations", 100)');
                lines.push('        results = items[:max_iterations]');
                lines.push('        return {"completed": results, "item": items[-1] if items else None, "index": len(items) - 1}');
                lines.push('');
                break;
            case 'input':
                lines.push('    def _execute_input_node(self, config: dict, inputs: dict) -> dict:');
                lines.push('        return {"value": config.get("defaultValue", "")}');
                lines.push('');
                break;
            case 'output':
                lines.push('    def _execute_output_node(self, config: dict, inputs: dict) -> dict:');
                lines.push('        return {"result": inputs.get("value")}');
                lines.push('');
                break;
            default:
                lines.push(`    def _execute_${nodeType}_node(self, config: dict, inputs: dict) -> dict:`);
                lines.push('        return inputs');
                lines.push('');
        }

        return lines;
    }

    private sanitizeId(id: string): string {
        return id.replace(/-/g, '_');
    }

    private calculateChecksum(code: string): string {
        let hash = 0;
        for (let i = 0; i < code.length; i++) {
            const char = code.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16);
    }
}

// ============================================================================
// NaturalLanguageBuilder
// ============================================================================

export class NaturalLanguageBuilder {
    private patterns: Map<RegExp, (match: RegExpMatchArray) => Partial<WorkflowData>> = new Map();

    constructor() {
        this.registerDefaultPatterns();
    }

    async buildFromDescription(description: string): Promise<WorkflowData> {
        const workflow: WorkflowData = {
            id: randomUUID(),
            name: this.extractWorkflowName(description),
            description,
            version: '1.0.0',
            nodes: [],
            connections: [],
            variables: {},
            metadata: {
                createdAt: new Date(),
                updatedAt: new Date(),
                tags: this.extractTags(description),
            },
        };

        // Parse the description and build workflow
        const parsedStructure = await this.parseDescription(description);

        // Add nodes based on parsed structure
        let lastNodeId: string | null = null;
        let yPosition = 100;

        for (const nodeInfo of parsedStructure.nodes) {
            const node = NodeFactory.createNode(nodeInfo.type, {
                name: nodeInfo.name,
                position: { x: 200, y: yPosition },
                config: nodeInfo.config,
            });

            workflow.nodes.push(node.toData());

            // Auto-connect sequential nodes
            if (lastNodeId) {
                workflow.connections.push({
                    id: randomUUID(),
                    sourceNodeId: lastNodeId,
                    sourcePortId: this.getDefaultOutputPort(workflow.nodes.find(n => n.id === lastNodeId)!.type),
                    targetNodeId: node.id,
                    targetPortId: this.getDefaultInputPort(node.type),
                    connectionType: 'data',
                });
            }

            lastNodeId = node.id;
            yPosition += 150;
        }

        return workflow;
    }

    private registerDefaultPatterns(): void {
        // Pattern: "call API at <url>"
        this.patterns.set(
            /call\s+(?:an?\s+)?api\s+(?:at\s+)?(?:endpoint\s+)?['""]?([^\s'"]+)['""]?/i,
            (match) => ({
                nodes: [{
                    type: 'api' as NodeType,
                    name: `API Call: ${match[1]}`,
                    config: { url: match[1], method: 'GET' },
                }],
            })
        );

        // Pattern: "make LLM call" or "ask AI"
        this.patterns.set(
            /(?:make\s+(?:an?\s+)?llm\s+call|ask\s+(?:the\s+)?ai|generate\s+(?:text|response)|use\s+(?:gpt|claude|llm))/i,
            () => ({
                nodes: [{
                    type: 'llm' as NodeType,
                    name: 'AI Response',
                    config: { model: 'gpt-4', temperature: 0.7 },
                }],
            })
        );

        // Pattern: "if <condition> then"
        this.patterns.set(
            /if\s+(.+?)\s+(?:then|do)/i,
            (match) => ({
                nodes: [{
                    type: 'condition' as NodeType,
                    name: `Check: ${match[1]}`,
                    config: { expression: match[1], operator: 'expression' },
                }],
            })
        );

        // Pattern: "loop through" or "for each"
        this.patterns.set(
            /(?:loop\s+through|for\s+each|iterate\s+(?:over|through))\s+(.+)/i,
            (match) => ({
                nodes: [{
                    type: 'loop' as NodeType,
                    name: `Loop: ${match[1]}`,
                    config: { loopType: 'forEach', maxIterations: 100 },
                }],
            })
        );

        // Pattern: "transform" or "convert"
        this.patterns.set(
            /(?:transform|convert|map|filter|format)\s+(?:the\s+)?(?:data|result|response)?/i,
            () => ({
                nodes: [{
                    type: 'transform' as NodeType,
                    name: 'Transform Data',
                    config: { transformType: 'custom' },
                }],
            })
        );

        // Pattern: "wait" or "delay"
        this.patterns.set(
            /(?:wait|delay|pause)\s+(?:for\s+)?(\d+)\s*(?:ms|milliseconds?|s(?:ec(?:ond)?s?)?|m(?:in(?:ute)?s?)?)?/i,
            (match) => {
                let ms = parseInt(match[1]!, 10);
                const unit = match[2]?.toLowerCase() || 'ms';
                if (unit.startsWith('s')) ms *= 1000;
                if (unit.startsWith('m')) ms *= 60000;
                return {
                    nodes: [{
                        type: 'delay' as NodeType,
                        name: `Delay ${ms}ms`,
                        config: { delayMs: ms },
                    }],
                };
            }
        );
    }

    private async parseDescription(description: string): Promise<{ nodes: Array<{ type: NodeType; name: string; config: NodeConfig }> }> {
        const nodes: Array<{ type: NodeType; name: string; config: NodeConfig }> = [];

        // Add input node
        nodes.push({
            type: 'input',
            name: 'Workflow Input',
            config: { inputType: 'text' },
        });

        // Match patterns
        for (const [pattern, builder] of this.patterns) {
            const match = description.match(pattern);
            if (match) {
                const result = builder(match);
                if (result.nodes) {
                    for (const nodeInfo of result.nodes) {
                        nodes.push({
                            type: nodeInfo.type as NodeType,
                            name: nodeInfo.name || 'Unnamed Node',
                            config: nodeInfo.config || {},
                        });
                    }
                }
            }
        }

        // Add output node
        nodes.push({
            type: 'output',
            name: 'Workflow Output',
            config: { outputKey: 'result' },
        });

        // If no patterns matched, create a simple LLM workflow
        if (nodes.length === 2) {
            nodes.splice(1, 0, {
                type: 'llm',
                name: 'Process Request',
                config: {
                    model: 'gpt-4',
                    userPromptTemplate: description,
                },
            });
        }

        return { nodes };
    }

    private extractWorkflowName(description: string): string {
        // Extract a reasonable name from the description
        const words = description.split(/\s+/).slice(0, 5);
        return words.join(' ').substring(0, 50) || 'New Workflow';
    }

    private extractTags(description: string): string[] {
        const tags: string[] = [];
        const keywords = ['api', 'llm', 'ai', 'data', 'transform', 'loop', 'condition', 'webhook'];

        for (const keyword of keywords) {
            if (description.toLowerCase().includes(keyword)) {
                tags.push(keyword);
            }
        }

        return tags;
    }

    private getDefaultOutputPort(nodeType: NodeType): string {
        const portMap: Record<NodeType, string> = {
            llm: 'response',
            condition: 'true',
            loop: 'completed',
            api: 'response',
            transform: 'result',
            input: 'value',
            output: 'value',
            merge: 'merged',
            split: 'items',
            delay: 'passthrough',
            webhook: 'body',
        };
        return portMap[nodeType] || 'output';
    }

    private getDefaultInputPort(nodeType: NodeType): string {
        const portMap: Record<NodeType, string> = {
            llm: 'prompt',
            condition: 'value',
            loop: 'items',
            api: 'url',
            transform: 'data',
            input: 'value',
            output: 'value',
            merge: 'input1',
            split: 'data',
            delay: 'passthrough',
            webhook: 'body',
        };
        return portMap[nodeType] || 'input';
    }

    registerPattern(pattern: RegExp, builder: (match: RegExpMatchArray) => Partial<WorkflowData>): void {
        this.patterns.set(pattern, builder);
    }
}

// ============================================================================
// WorkflowSerializer
// ============================================================================

export class WorkflowSerializer {
    serialize(workflow: WorkflowData): string {
        return JSON.stringify(workflow, null, 2);
    }

    deserialize(json: string): WorkflowData {
        const data = JSON.parse(json) as WorkflowData;

        // Validate structure
        this.validateStructure(data);

        // Convert date strings to Date objects
        data.metadata.createdAt = new Date(data.metadata.createdAt);
        data.metadata.updatedAt = new Date(data.metadata.updatedAt);

        for (const node of data.nodes) {
            node.metadata.createdAt = new Date(node.metadata.createdAt);
            node.metadata.updatedAt = new Date(node.metadata.updatedAt);
        }

        return data;
    }

    private validateStructure(data: unknown): asserts data is WorkflowData {
        if (!data || typeof data !== 'object') {
            throw new Error('Invalid workflow data: expected object');
        }

        const workflow = data as Record<string, unknown>;

        if (typeof workflow.id !== 'string') {
            throw new Error('Invalid workflow data: missing or invalid id');
        }

        if (typeof workflow.name !== 'string') {
            throw new Error('Invalid workflow data: missing or invalid name');
        }

        if (!Array.isArray(workflow.nodes)) {
            throw new Error('Invalid workflow data: nodes must be an array');
        }

        if (!Array.isArray(workflow.connections)) {
            throw new Error('Invalid workflow data: connections must be an array');
        }
    }

    async saveToFile(workflow: WorkflowData, filePath: string): Promise<void> {
        const fs = await import('fs/promises');
        const json = this.serialize(workflow);
        await fs.writeFile(filePath, json, 'utf-8');
    }

    async loadFromFile(filePath: string): Promise<WorkflowData> {
        const fs = await import('fs/promises');
        const json = await fs.readFile(filePath, 'utf-8');
        return this.deserialize(json);
    }

    exportToYAML(workflow: WorkflowData): string {
        // Simple YAML-like format (not full YAML spec)
        const lines: string[] = [
            `id: ${workflow.id}`,
            `name: ${workflow.name}`,
            `description: ${workflow.description}`,
            `version: ${workflow.version}`,
            'nodes:',
        ];

        for (const node of workflow.nodes) {
            lines.push(`  - id: ${node.id}`);
            lines.push(`    type: ${node.type}`);
            lines.push(`    name: ${node.name}`);
            lines.push(`    position:`);
            lines.push(`      x: ${node.position.x}`);
            lines.push(`      y: ${node.position.y}`);
        }

        lines.push('connections:');
        for (const conn of workflow.connections) {
            lines.push(`  - id: ${conn.id}`);
            lines.push(`    source: ${conn.sourceNodeId}:${conn.sourcePortId}`);
            lines.push(`    target: ${conn.targetNodeId}:${conn.targetPortId}`);
        }

        return lines.join('\n');
    }
}

// ============================================================================
// TemplateLibrary
// ============================================================================

export class TemplateLibrary {
    private templates: Map<string, WorkflowTemplate> = new Map();

    constructor() {
        this.registerBuiltInTemplates();
    }

    private registerBuiltInTemplates(): void {
        // Template: Simple API Chain
        this.addTemplate({
            id: 'api-chain',
            name: 'API Chain',
            description: 'Fetch data from an API, transform it, and output the result',
            category: 'Data Processing',
            tags: ['api', 'transform', 'beginner'],
            workflow: this.createAPIChainWorkflow(),
            popularity: 100,
            author: 'Astra',
            createdAt: new Date(),
        });

        // Template: LLM Processing Pipeline
        this.addTemplate({
            id: 'llm-pipeline',
            name: 'LLM Processing Pipeline',
            description: 'Process input through an LLM and format the output',
            category: 'AI/ML',
            tags: ['llm', 'ai', 'text-processing'],
            workflow: this.createLLMPipelineWorkflow(),
            popularity: 95,
            author: 'Astra',
            createdAt: new Date(),
        });

        // Template: Conditional Router
        this.addTemplate({
            id: 'conditional-router',
            name: 'Conditional Router',
            description: 'Route data based on conditions to different processing paths',
            category: 'Control Flow',
            tags: ['condition', 'routing', 'branching'],
            workflow: this.createConditionalRouterWorkflow(),
            popularity: 85,
            author: 'Astra',
            createdAt: new Date(),
        });

        // Template: Batch Processor
        this.addTemplate({
            id: 'batch-processor',
            name: 'Batch Processor',
            description: 'Process items in a loop with transformation',
            category: 'Data Processing',
            tags: ['loop', 'batch', 'transform'],
            workflow: this.createBatchProcessorWorkflow(),
            popularity: 80,
            author: 'Astra',
            createdAt: new Date(),
        });

        // Template: Webhook Handler
        this.addTemplate({
            id: 'webhook-handler',
            name: 'Webhook Handler',
            description: 'Handle incoming webhooks and process the data',
            category: 'Integration',
            tags: ['webhook', 'api', 'integration'],
            workflow: this.createWebhookHandlerWorkflow(),
            popularity: 75,
            author: 'Astra',
            createdAt: new Date(),
        });
    }

    private createAPIChainWorkflow(): WorkflowData {
        const inputNode = new InputNode({ position: { x: 100, y: 100 } });
        const apiNode = new APINode({
            position: { x: 300, y: 100 },
            config: { url: 'https://api.example.com/data', method: 'GET' },
        });
        const transformNode = new TransformNode({
            position: { x: 500, y: 100 },
            config: { transformType: 'jmespath', expression: 'data.results' },
        });
        const outputNode = new OutputNode({ position: { x: 700, y: 100 } });

        return {
            id: randomUUID(),
            name: 'API Chain',
            description: 'Fetch data from an API, transform it, and output the result',
            version: '1.0.0',
            nodes: [inputNode.toData(), apiNode.toData(), transformNode.toData(), outputNode.toData()],
            connections: [
                {
                    id: randomUUID(),
                    sourceNodeId: inputNode.id,
                    sourcePortId: 'value',
                    targetNodeId: apiNode.id,
                    targetPortId: 'url',
                    connectionType: 'data',
                },
                {
                    id: randomUUID(),
                    sourceNodeId: apiNode.id,
                    sourcePortId: 'response',
                    targetNodeId: transformNode.id,
                    targetPortId: 'data',
                    connectionType: 'data',
                },
                {
                    id: randomUUID(),
                    sourceNodeId: transformNode.id,
                    sourcePortId: 'result',
                    targetNodeId: outputNode.id,
                    targetPortId: 'value',
                    connectionType: 'data',
                },
            ],
            variables: {},
            metadata: {
                createdAt: new Date(),
                updatedAt: new Date(),
                tags: ['api', 'transform'],
                category: 'Data Processing',
            },
        };
    }

    private createLLMPipelineWorkflow(): WorkflowData {
        const inputNode = new InputNode({ position: { x: 100, y: 100 } });
        const llmNode = new LLMNode({
            position: { x: 300, y: 100 },
            config: {
                model: 'gpt-4',
                systemPrompt: 'You are a helpful assistant.',
                userPromptTemplate: '{{input}}',
            },
        });
        const transformNode = new TransformNode({
            position: { x: 500, y: 100 },
            config: { transformType: 'stringify' },
        });
        const outputNode = new OutputNode({ position: { x: 700, y: 100 } });

        return {
            id: randomUUID(),
            name: 'LLM Processing Pipeline',
            description: 'Process input through an LLM and format the output',
            version: '1.0.0',
            nodes: [inputNode.toData(), llmNode.toData(), transformNode.toData(), outputNode.toData()],
            connections: [
                {
                    id: randomUUID(),
                    sourceNodeId: inputNode.id,
                    sourcePortId: 'value',
                    targetNodeId: llmNode.id,
                    targetPortId: 'prompt',
                    connectionType: 'data',
                },
                {
                    id: randomUUID(),
                    sourceNodeId: llmNode.id,
                    sourcePortId: 'response',
                    targetNodeId: transformNode.id,
                    targetPortId: 'data',
                    connectionType: 'data',
                },
                {
                    id: randomUUID(),
                    sourceNodeId: transformNode.id,
                    sourcePortId: 'result',
                    targetNodeId: outputNode.id,
                    targetPortId: 'value',
                    connectionType: 'data',
                },
            ],
            variables: {},
            metadata: {
                createdAt: new Date(),
                updatedAt: new Date(),
                tags: ['llm', 'ai'],
                category: 'AI/ML',
            },
        };
    }

    private createConditionalRouterWorkflow(): WorkflowData {
        const inputNode = new InputNode({ position: { x: 100, y: 200 } });
        const conditionNode = new ConditionNode({
            position: { x: 300, y: 200 },
            config: { operator: 'contains', compareValue: 'important' },
        });
        const llmNode = new LLMNode({
            position: { x: 500, y: 100 },
            name: 'High Priority Processing',
        });
        const transformNode = new TransformNode({
            position: { x: 500, y: 300 },
            name: 'Standard Processing',
        });
        const mergeNode = new MergeNode({ position: { x: 700, y: 200 } });
        const outputNode = new OutputNode({ position: { x: 900, y: 200 } });

        return {
            id: randomUUID(),
            name: 'Conditional Router',
            description: 'Route data based on conditions to different processing paths',
            version: '1.0.0',
            nodes: [
                inputNode.toData(),
                conditionNode.toData(),
                llmNode.toData(),
                transformNode.toData(),
                mergeNode.toData(),
                outputNode.toData()
            ],
            connections: [
                {
                    id: randomUUID(),
                    sourceNodeId: inputNode.id,
                    sourcePortId: 'value',
                    targetNodeId: conditionNode.id,
                    targetPortId: 'value',
                    connectionType: 'data',
                },
                {
                    id: randomUUID(),
                    sourceNodeId: conditionNode.id,
                    sourcePortId: 'true',
                    targetNodeId: llmNode.id,
                    targetPortId: 'prompt',
                    connectionType: 'conditional',
                    condition: 'true',
                },
                {
                    id: randomUUID(),
                    sourceNodeId: conditionNode.id,
                    sourcePortId: 'false',
                    targetNodeId: transformNode.id,
                    targetPortId: 'data',
                    connectionType: 'conditional',
                    condition: 'false',
                },
                {
                    id: randomUUID(),
                    sourceNodeId: llmNode.id,
                    sourcePortId: 'response',
                    targetNodeId: mergeNode.id,
                    targetPortId: 'input1',
                    connectionType: 'data',
                },
                {
                    id: randomUUID(),
                    sourceNodeId: transformNode.id,
                    sourcePortId: 'result',
                    targetNodeId: mergeNode.id,
                    targetPortId: 'input2',
                    connectionType: 'data',
                },
                {
                    id: randomUUID(),
                    sourceNodeId: mergeNode.id,
                    sourcePortId: 'merged',
                    targetNodeId: outputNode.id,
                    targetPortId: 'value',
                    connectionType: 'data',
                },
            ],
            variables: {},
            metadata: {
                createdAt: new Date(),
                updatedAt: new Date(),
                tags: ['condition', 'routing'],
                category: 'Control Flow',
            },
        };
    }

    private createBatchProcessorWorkflow(): WorkflowData {
        const inputNode = new InputNode({ position: { x: 100, y: 100 } });
        const splitNode = new SplitNode({ position: { x: 300, y: 100 } });
        const loopNode = new LoopNode({ position: { x: 500, y: 100 } });
        const transformNode = new TransformNode({
            position: { x: 700, y: 100 },
            config: { transformType: 'map', expression: 'item.toUpperCase()' },
        });
        const outputNode = new OutputNode({ position: { x: 900, y: 100 } });

        return {
            id: randomUUID(),
            name: 'Batch Processor',
            description: 'Process items in a loop with transformation',
            version: '1.0.0',
            nodes: [inputNode.toData(), splitNode.toData(), loopNode.toData(), transformNode.toData(), outputNode.toData()],
            connections: [
                {
                    id: randomUUID(),
                    sourceNodeId: inputNode.id,
                    sourcePortId: 'value',
                    targetNodeId: splitNode.id,
                    targetPortId: 'data',
                    connectionType: 'data',
                },
                {
                    id: randomUUID(),
                    sourceNodeId: splitNode.id,
                    sourcePortId: 'items',
                    targetNodeId: loopNode.id,
                    targetPortId: 'items',
                    connectionType: 'data',
                },
                {
                    id: randomUUID(),
                    sourceNodeId: loopNode.id,
                    sourcePortId: 'completed',
                    targetNodeId: transformNode.id,
                    targetPortId: 'data',
                    connectionType: 'data',
                },
                {
                    id: randomUUID(),
                    sourceNodeId: transformNode.id,
                    sourcePortId: 'result',
                    targetNodeId: outputNode.id,
                    targetPortId: 'value',
                    connectionType: 'data',
                },
            ],
            variables: {},
            metadata: {
                createdAt: new Date(),
                updatedAt: new Date(),
                tags: ['loop', 'batch'],
                category: 'Data Processing',
            },
        };
    }

    private createWebhookHandlerWorkflow(): WorkflowData {
        const webhookNode = new WebhookNode({
            position: { x: 100, y: 100 },
            config: { path: '/webhook/incoming', method: 'POST' },
        });
        const transformNode = new TransformNode({
            position: { x: 300, y: 100 },
            config: { transformType: 'jmespath', expression: 'body.data' },
        });
        const conditionNode = new ConditionNode({
            position: { x: 500, y: 100 },
            config: { operator: 'isNotEmpty' },
        });
        const apiNode = new APINode({
            position: { x: 700, y: 50 },
            config: { url: 'https://api.example.com/process', method: 'POST' },
        });
        const outputNode = new OutputNode({ position: { x: 900, y: 100 } });

        return {
            id: randomUUID(),
            name: 'Webhook Handler',
            description: 'Handle incoming webhooks and process the data',
            version: '1.0.0',
            nodes: [webhookNode.toData(), transformNode.toData(), conditionNode.toData(), apiNode.toData(), outputNode.toData()],
            connections: [
                {
                    id: randomUUID(),
                    sourceNodeId: webhookNode.id,
                    sourcePortId: 'body',
                    targetNodeId: transformNode.id,
                    targetPortId: 'data',
                    connectionType: 'data',
                },
                {
                    id: randomUUID(),
                    sourceNodeId: transformNode.id,
                    sourcePortId: 'result',
                    targetNodeId: conditionNode.id,
                    targetPortId: 'value',
                    connectionType: 'data',
                },
                {
                    id: randomUUID(),
                    sourceNodeId: conditionNode.id,
                    sourcePortId: 'true',
                    targetNodeId: apiNode.id,
                    targetPortId: 'body',
                    connectionType: 'conditional',
                },
                {
                    id: randomUUID(),
                    sourceNodeId: apiNode.id,
                    sourcePortId: 'response',
                    targetNodeId: outputNode.id,
                    targetPortId: 'value',
                    connectionType: 'data',
                },
            ],
            variables: {},
            metadata: {
                createdAt: new Date(),
                updatedAt: new Date(),
                tags: ['webhook', 'api'],
                category: 'Integration',
            },
        };
    }

    addTemplate(template: WorkflowTemplate): void {
        this.templates.set(template.id, template);
    }

    getTemplate(id: string): WorkflowTemplate | undefined {
        return this.templates.get(id);
    }

    listTemplates(options: {
        category?: string;
        tags?: string[];
        sortBy?: 'popularity' | 'name' | 'createdAt';
    } = {}): WorkflowTemplate[] {
        let templates = Array.from(this.templates.values());

        if (options.category) {
            templates = templates.filter(t => t.category === options.category);
        }

        if (options.tags && options.tags.length > 0) {
            templates = templates.filter(t =>
                options.tags!.some(tag => t.tags.includes(tag))
            );
        }

        switch (options.sortBy) {
            case 'popularity':
                templates.sort((a, b) => b.popularity - a.popularity);
                break;
            case 'name':
                templates.sort((a, b) => a.name.localeCompare(b.name));
                break;
            case 'createdAt':
                templates.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
                break;
        }

        return templates;
    }

    getCategories(): string[] {
        const categories = new Set<string>();
        for (const template of this.templates.values()) {
            categories.add(template.category);
        }
        return Array.from(categories);
    }

    getTags(): string[] {
        const tags = new Set<string>();
        for (const template of this.templates.values()) {
            for (const tag of template.tags) {
                tags.add(tag);
            }
        }
        return Array.from(tags);
    }

    createWorkflowFromTemplate(templateId: string): WorkflowData {
        const template = this.getTemplate(templateId);
        if (!template) {
            throw new Error(`Template not found: ${templateId}`);
        }

        // Deep clone the workflow and assign new IDs
        const workflow = JSON.parse(JSON.stringify(template.workflow)) as WorkflowData;

        // Generate new IDs
        const idMap = new Map<string, string>();
        workflow.id = randomUUID();

        for (const node of workflow.nodes) {
            const oldId = node.id;
            node.id = randomUUID();
            idMap.set(oldId, node.id);
            node.metadata.createdAt = new Date();
            node.metadata.updatedAt = new Date();
        }

        // Update connection references
        for (const conn of workflow.connections) {
            conn.id = randomUUID();
            conn.sourceNodeId = idMap.get(conn.sourceNodeId) || conn.sourceNodeId;
            conn.targetNodeId = idMap.get(conn.targetNodeId) || conn.targetNodeId;
        }

        workflow.metadata.createdAt = new Date();
        workflow.metadata.updatedAt = new Date();

        return workflow;
    }
}

// ============================================================================
// MagicCanvas - Main Class
// ============================================================================

export class MagicCanvas {
    private workflows: Map<string, WorkflowGraph> = new Map();
    private executor: WorkflowExecutor;
    private compiler: WorkflowCompiler;
    private nlBuilder: NaturalLanguageBuilder;
    private serializer: WorkflowSerializer;
    private validator: ValidationEngine;
    private templateLibrary: TemplateLibrary;

    constructor() {
        this.executor = new WorkflowExecutor();
        this.compiler = new WorkflowCompiler();
        this.nlBuilder = new NaturalLanguageBuilder();
        this.serializer = new WorkflowSerializer();
        this.validator = new ValidationEngine();
        this.templateLibrary = new TemplateLibrary();
    }

    /**
     * Create a new workflow
     */
    createWorkflow(options: {
        name?: string;
        description?: string;
        fromTemplate?: string;
        fromDescription?: string;
    } = {}): WorkflowGraph {
        const graph = new WorkflowGraph();

        if (options.fromTemplate) {
            const workflowData = this.templateLibrary.createWorkflowFromTemplate(options.fromTemplate);
            return WorkflowGraph.fromData(workflowData);
        }

        // Store the workflow
        const workflowId = randomUUID();
        this.workflows.set(workflowId, graph);

        return graph;
    }

    /**
     * Create a workflow from natural language description
     */
    async createWorkflowFromDescription(description: string): Promise<WorkflowGraph> {
        const workflowData = await this.nlBuilder.buildFromDescription(description);
        const graph = WorkflowGraph.fromData(workflowData);

        const workflowId = workflowData.id;
        this.workflows.set(workflowId, graph);

        return graph;
    }

    /**
     * Execute a workflow
     */
    async executeWorkflow(
        workflow: WorkflowGraph | string,
        inputs: Record<string, unknown> = {},
        options: {
            timeout?: number;
            onProgress?: (progress: ExecutionProgress) => void;
        } = {}
    ): Promise<ExecutionResult> {
        const graph = typeof workflow === 'string'
            ? this.workflows.get(workflow)
            : workflow;

        if (!graph) {
            throw new Error('Workflow not found');
        }

        return this.executor.execute(graph, inputs, options);
    }

    /**
     * Validate a workflow
     */
    validateWorkflow(workflow: WorkflowGraph | string): ValidationResult {
        const graph = typeof workflow === 'string'
            ? this.workflows.get(workflow)
            : workflow;

        if (!graph) {
            throw new Error('Workflow not found');
        }

        return this.validator.validate(graph);
    }

    /**
     * Compile workflow to executable code
     */
    compileWorkflow(
        workflow: WorkflowGraph | WorkflowData,
        language: 'typescript' | 'python' | 'json' = 'typescript'
    ): CompiledWorkflow {
        const workflowData = workflow instanceof WorkflowGraph
            ? this.graphToWorkflowData(workflow, 'Compiled Workflow', '')
            : workflow;

        return this.compiler.compile(workflowData, language);
    }

    /**
     * Save workflow to JSON
     */
    serializeWorkflow(workflow: WorkflowGraph, name: string, description: string = ''): string {
        const workflowData = this.graphToWorkflowData(workflow, name, description);
        return this.serializer.serialize(workflowData);
    }

    /**
     * Load workflow from JSON
     */
    deserializeWorkflow(json: string): WorkflowGraph {
        const workflowData = this.serializer.deserialize(json);
        return WorkflowGraph.fromData(workflowData);
    }

    /**
     * Get available templates
     */
    getTemplates(options?: {
        category?: string;
        tags?: string[];
        sortBy?: 'popularity' | 'name' | 'createdAt';
    }): WorkflowTemplate[] {
        return this.templateLibrary.listTemplates(options);
    }

    /**
     * Create workflow from template
     */
    createFromTemplate(templateId: string): WorkflowGraph {
        const workflowData = this.templateLibrary.createWorkflowFromTemplate(templateId);
        return WorkflowGraph.fromData(workflowData);
    }

    /**
     * Add a custom template
     */
    addTemplate(template: Omit<WorkflowTemplate, 'id' | 'createdAt'>): string {
        const id = randomUUID();
        this.templateLibrary.addTemplate({
            ...template,
            id,
            createdAt: new Date(),
        });
        return id;
    }

    /**
     * Get available node types
     */
    getAvailableNodeTypes(): NodeType[] {
        return NodeFactory.getAvailableNodeTypes();
    }

    /**
     * Create a node
     */
    createNode(type: NodeType, data?: Partial<WorkflowNodeData>): WorkflowNode {
        return NodeFactory.createNode(type, data);
    }

    /**
     * Abort running workflow execution
     */
    abortExecution(): void {
        this.executor.abort();
    }

    /**
     * Get the Natural Language Builder for custom patterns
     */
    getNaturalLanguageBuilder(): NaturalLanguageBuilder {
        return this.nlBuilder;
    }

    /**
     * Get template library for advanced operations
     */
    getTemplateLibrary(): TemplateLibrary {
        return this.templateLibrary;
    }

    private graphToWorkflowData(graph: WorkflowGraph, name: string, description: string): WorkflowData {
        const data = graph.toData();
        return {
            id: randomUUID(),
            name,
            description,
            version: '1.0.0',
            nodes: data.nodes,
            connections: data.connections,
            variables: {},
            metadata: {
                createdAt: new Date(),
                updatedAt: new Date(),
                tags: [],
            },
        };
    }
}

// ============================================================================
// Export convenience functions
// ============================================================================

export function createCanvas(): MagicCanvas {
    return new MagicCanvas();
}

export function createNode(type: NodeType, data?: Partial<WorkflowNodeData>): WorkflowNode {
    return NodeFactory.createNode(type, data);
}

export function createGraph(): WorkflowGraph {
    return new WorkflowGraph();
}
