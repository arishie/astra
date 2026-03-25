/**
 * Shell.ts - Custom AI Agent System
 *
 * A "Shell" is a customizable AI agent that users can create, configure,
 * and connect together. Think of it like a container for AI behavior.
 *
 * Features:
 * - Easy to create and customize
 * - Can communicate with other shells
 * - Integrates with n8n workflows
 * - Can write and execute code
 * - Monitored by a supervisor
 */
import { EventEmitter } from 'events';
import crypto from 'crypto';
// ============================================================================
// Shell Class - Individual AI Agent
// ============================================================================
export class Shell extends EventEmitter {
    id;
    config;
    status = 'idle';
    taskQueue = [];
    currentTask = null;
    messageHistory = [];
    memory = new Map();
    startTime;
    completedCount = 0;
    failedCount = 0;
    lastActivity;
    constructor(config) {
        super();
        this.id = config.id || `shell_${crypto.randomBytes(8).toString('hex')}`;
        this.config = {
            ...config,
            id: this.id,
            temperature: config.temperature ?? 0.7,
            maxTokens: config.maxTokens ?? 4096,
            maxConcurrentTasks: config.maxConcurrentTasks ?? 1,
            taskTimeout: config.taskTimeout ?? 300000, // 5 minutes
            maxRetries: config.maxRetries ?? 3,
        };
        this.startTime = new Date();
        this.lastActivity = new Date();
    }
    // ---- Status Management ----
    getStatus() {
        return this.status;
    }
    setStatus(status) {
        const oldStatus = this.status;
        this.status = status;
        this.lastActivity = new Date();
        this.emit('statusChange', { shell: this.id, from: oldStatus, to: status });
        // Trigger n8n webhook if configured
        this.triggerN8n('status_change', { from: oldStatus, to: status });
    }
    getState() {
        return {
            id: this.id,
            name: this.config.name,
            role: this.config.role,
            status: this.status,
            currentTask: this.currentTask || undefined,
            pendingTasks: this.taskQueue.length,
            completedTasks: this.completedCount,
            failedTasks: this.failedCount,
            lastActivity: this.lastActivity,
            uptime: Date.now() - this.startTime.getTime(),
        };
    }
    // ---- Task Management ----
    async assignTask(task) {
        const newTask = {
            id: `task_${crypto.randomBytes(8).toString('hex')}`,
            assignedTo: this.id,
            status: 'pending',
            createdAt: new Date(),
            ...task,
        };
        this.taskQueue.push(newTask);
        this.emit('taskAssigned', { shell: this.id, task: newTask });
        // Start processing if idle
        if (this.status === 'idle') {
            this.processNextTask();
        }
        return newTask;
    }
    async processNextTask() {
        if (this.taskQueue.length === 0) {
            this.setStatus('idle');
            return;
        }
        // Check dependencies
        const readyTask = this.taskQueue.find(t => this.areDependenciesMet(t));
        if (!readyTask) {
            this.setStatus('waiting');
            return;
        }
        // Remove from queue
        this.taskQueue = this.taskQueue.filter(t => t.id !== readyTask.id);
        this.currentTask = readyTask;
        this.currentTask.status = 'in_progress';
        this.currentTask.startedAt = new Date();
        this.setStatus('thinking');
        this.emit('taskStarted', { shell: this.id, task: this.currentTask });
        try {
            // Check if approval is required
            if (this.config.requiresApproval) {
                this.setStatus('waiting');
                this.emit('approvalRequired', { shell: this.id, task: this.currentTask });
                return; // Wait for approval
            }
            // Execute the task
            const result = await this.executeTask(this.currentTask);
            this.currentTask.status = 'completed';
            this.currentTask.result = result;
            this.currentTask.completedAt = new Date();
            this.completedCount++;
            this.emit('taskCompleted', { shell: this.id, task: this.currentTask, result });
            this.triggerN8n('task_complete', { task: this.currentTask, result });
        }
        catch (error) {
            this.currentTask.status = 'failed';
            this.currentTask.error = error instanceof Error ? error.message : String(error);
            this.currentTask.completedAt = new Date();
            this.failedCount++;
            this.emit('taskFailed', { shell: this.id, task: this.currentTask, error });
            this.triggerN8n('task_failed', { task: this.currentTask, error: this.currentTask.error });
        }
        this.currentTask = null;
        this.processNextTask();
    }
    areDependenciesMet(task) {
        if (!task.dependencies || task.dependencies.length === 0) {
            return true;
        }
        // Would check against completed tasks from ShellManager
        return true;
    }
    async executeTask(task) {
        this.setStatus('executing');
        // In production, this would:
        // 1. Build a prompt from task + system prompt
        // 2. Call LLM
        // 3. Parse response and execute actions based on capabilities
        // 4. Return result
        // Simulated execution
        await new Promise(resolve => setTimeout(resolve, 100));
        return {
            success: true,
            output: `Task "${task.title}" completed by ${this.config.name}`,
            timestamp: new Date(),
        };
    }
    approveTask(taskId) {
        if (this.currentTask?.id === taskId && this.status === 'waiting') {
            this.processNextTask();
        }
    }
    rejectTask(taskId, reason) {
        if (this.currentTask?.id === taskId) {
            this.currentTask.status = 'cancelled';
            this.currentTask.error = `Rejected: ${reason}`;
            this.currentTask = null;
            this.processNextTask();
        }
    }
    // ---- Messaging ----
    sendMessage(to, content, type = 'update', data) {
        const message = {
            id: `msg_${crypto.randomBytes(8).toString('hex')}`,
            from: this.id,
            to,
            type,
            content,
            data,
            timestamp: new Date(),
            priority: 'normal',
        };
        this.messageHistory.push(message);
        this.emit('messageSent', message);
        this.triggerN8n('message_received', { message });
        return message;
    }
    receiveMessage(message) {
        // Check if we can receive from this sender
        if (this.config.canReceiveFrom !== 'all') {
            if (!this.config.canReceiveFrom.includes(message.from)) {
                return; // Ignore message from unauthorized sender
            }
        }
        this.messageHistory.push(message);
        this.lastActivity = new Date();
        this.emit('messageReceived', message);
        // Handle different message types
        if (message.type === 'task') {
            // Convert message to task
            this.assignTask({
                title: message.content,
                description: message.data?.description || message.content,
                assignedBy: message.from,
                priority: message.priority,
            });
        }
    }
    // ---- Memory ----
    setMemory(key, value) {
        this.memory.set(key, value);
        this.emit('memoryUpdated', { shell: this.id, key, value });
    }
    getMemory(key) {
        return this.memory.get(key);
    }
    getAllMemory() {
        return Object.fromEntries(this.memory);
    }
    // ---- n8n Integration ----
    async triggerN8n(event, data) {
        if (!this.config.n8nTriggers)
            return;
        const triggers = this.config.n8nTriggers.filter(t => t.event === event);
        for (const trigger of triggers) {
            try {
                const payload = {
                    shellId: this.id,
                    shellName: this.config.name,
                    event,
                    timestamp: new Date().toISOString(),
                    ...trigger.payload,
                    ...data,
                };
                await fetch(trigger.webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                this.emit('n8nTriggered', { shell: this.id, event, webhookUrl: trigger.webhookUrl });
            }
            catch (error) {
                console.error(`[Shell ${this.id}] n8n trigger failed:`, error);
            }
        }
    }
    // ---- Lifecycle ----
    pause() {
        this.setStatus('paused');
    }
    resume() {
        if (this.status === 'paused') {
            this.processNextTask();
        }
    }
    async shutdown() {
        this.setStatus('idle');
        this.taskQueue = [];
        this.currentTask = null;
        this.emit('shutdown', { shell: this.id });
    }
}
// ============================================================================
// Export
// ============================================================================
export default Shell;
//# sourceMappingURL=Shell.js.map