/**
 * Shell API Routes
 *
 * REST API for managing shells (custom AI agents).
 * Also provides webhook endpoints for n8n integration.
 */
import { Router } from 'express';
import { ShellManager, AllTemplates, getTemplate, getTemplatesByCategory, getSuggestedTeam, } from '../../shells/index.js';
const router = Router();
// Singleton manager instance (would be injected in production)
let shellManager = null;
export function setShellManager(manager) {
    shellManager = manager;
}
function getManager() {
    if (!shellManager) {
        shellManager = new ShellManager();
    }
    return shellManager;
}
// ============================================================================
// Templates
// ============================================================================
/**
 * GET /shells/templates - List all templates
 */
router.get('/templates', (req, res) => {
    const category = req.query.category;
    if (category) {
        res.json(getTemplatesByCategory(category));
    }
    else {
        res.json(AllTemplates);
    }
});
/**
 * GET /shells/templates/:id - Get single template
 */
router.get('/templates/:id', (req, res) => {
    const template = getTemplate(req.params.id);
    if (!template) {
        res.status(404).json({ error: 'Template not found' });
        return;
    }
    res.json(template);
});
/**
 * GET /shells/templates/team/:type - Get suggested team
 */
router.get('/templates/team/:type', (req, res) => {
    const type = req.params.type;
    res.json(getSuggestedTeam(type));
});
// ============================================================================
// Shell CRUD
// ============================================================================
/**
 * GET /shells - List all shells
 */
router.get('/', (req, res) => {
    const manager = getManager();
    const shells = manager.getAllShells().map(s => s.getState());
    res.json(shells);
});
/**
 * POST /shells - Create a new shell
 */
router.post('/', async (req, res) => {
    try {
        const config = req.body;
        if (!config.name || !config.role || !config.systemPrompt) {
            res.status(400).json({
                error: 'Missing required fields',
                required: ['name', 'role', 'systemPrompt']
            });
            return;
        }
        const manager = getManager();
        const shell = manager.createShell(config);
        res.status(201).json({
            id: shell.id,
            name: shell.config.name,
            role: shell.config.role,
            status: shell.getStatus(),
        });
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to create shell' });
    }
});
/**
 * POST /shells/from-template - Create shell from template
 */
router.post('/from-template', async (req, res) => {
    try {
        const { templateId, overrides } = req.body;
        const template = getTemplate(templateId);
        if (!template) {
            res.status(404).json({ error: 'Template not found' });
            return;
        }
        const manager = getManager();
        const shell = manager.createFromTemplate(template, overrides);
        res.status(201).json({
            id: shell.id,
            name: shell.config.name,
            role: shell.config.role,
            status: shell.getStatus(),
        });
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to create shell' });
    }
});
/**
 * GET /shells/:id - Get shell details
 */
router.get('/:id', (req, res) => {
    const manager = getManager();
    const shell = manager.getShell(req.params.id);
    if (!shell) {
        res.status(404).json({ error: 'Shell not found' });
        return;
    }
    res.json({
        ...shell.getState(),
        config: shell.config,
        memory: shell.getAllMemory(),
    });
});
/**
 * DELETE /shells/:id - Remove a shell
 */
router.delete('/:id', async (req, res) => {
    const manager = getManager();
    const removed = await manager.removeShell(req.params.id);
    if (!removed) {
        res.status(404).json({ error: 'Shell not found' });
        return;
    }
    res.json({ success: true, message: 'Shell removed' });
});
/**
 * POST /shells/:id/pause - Pause a shell
 */
router.post('/:id/pause', (req, res) => {
    const manager = getManager();
    const shell = manager.getShell(req.params.id);
    if (!shell) {
        res.status(404).json({ error: 'Shell not found' });
        return;
    }
    shell.pause();
    res.json({ success: true, status: shell.getStatus() });
});
/**
 * POST /shells/:id/resume - Resume a shell
 */
router.post('/:id/resume', (req, res) => {
    const manager = getManager();
    const shell = manager.getShell(req.params.id);
    if (!shell) {
        res.status(404).json({ error: 'Shell not found' });
        return;
    }
    shell.resume();
    res.json({ success: true, status: shell.getStatus() });
});
// ============================================================================
// Tasks
// ============================================================================
/**
 * POST /shells/:id/tasks - Assign task to shell
 */
router.post('/:id/tasks', async (req, res) => {
    try {
        const manager = getManager();
        const shell = manager.getShell(req.params.id);
        if (!shell) {
            res.status(404).json({ error: 'Shell not found' });
            return;
        }
        const { title, description, priority, dependencies } = req.body;
        if (!title) {
            res.status(400).json({ error: 'Task title required' });
            return;
        }
        const task = await shell.assignTask({
            title,
            description: description || title,
            assignedBy: 'api',
            priority: priority || 'normal',
            dependencies,
        });
        res.status(201).json(task);
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to assign task' });
    }
});
/**
 * POST /shells/:id/tasks/:taskId/approve - Approve pending task
 */
router.post('/:id/tasks/:taskId/approve', (req, res) => {
    const manager = getManager();
    manager.approveTask(req.params.id, req.params.taskId);
    res.json({ success: true, message: 'Task approved' });
});
/**
 * POST /shells/:id/tasks/:taskId/reject - Reject pending task
 */
router.post('/:id/tasks/:taskId/reject', (req, res) => {
    const { reason } = req.body;
    const manager = getManager();
    manager.rejectTask(req.params.id, req.params.taskId, reason || 'Rejected by user');
    res.json({ success: true, message: 'Task rejected' });
});
// ============================================================================
// Messaging
// ============================================================================
/**
 * POST /shells/:id/messages - Send message to shell
 */
router.post('/:id/messages', (req, res) => {
    const { content, data } = req.body;
    if (!content) {
        res.status(400).json({ error: 'Message content required' });
        return;
    }
    const manager = getManager();
    manager.sendToShell(req.params.id, content, data);
    res.json({ success: true, message: 'Message sent' });
});
/**
 * POST /shells/broadcast - Broadcast to all shells
 */
router.post('/broadcast', (req, res) => {
    const { content, type, data } = req.body;
    if (!content) {
        res.status(400).json({ error: 'Message content required' });
        return;
    }
    const manager = getManager();
    manager.broadcast(content, type || 'update', data);
    res.json({ success: true, message: 'Broadcast sent' });
});
// ============================================================================
// Workflows
// ============================================================================
/**
 * GET /shells/workflows - List all workflows
 */
router.get('/workflows', (req, res) => {
    const manager = getManager();
    res.json(manager.getAllWorkflows());
});
/**
 * POST /shells/workflows - Create workflow
 */
router.post('/workflows', (req, res) => {
    try {
        const { name, description, shells, connections, triggers } = req.body;
        if (!name || !shells || shells.length === 0) {
            res.status(400).json({ error: 'Workflow requires name and shells' });
            return;
        }
        const manager = getManager();
        const workflow = manager.createWorkflow({
            name,
            description: description || '',
            shells,
            connections: connections || [],
            triggers: triggers || [],
        });
        res.status(201).json(workflow);
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to create workflow' });
    }
});
/**
 * POST /shells/workflows/:id/start - Start workflow
 */
router.post('/workflows/:id/start', async (req, res) => {
    try {
        const { input } = req.body;
        const manager = getManager();
        await manager.startWorkflow(req.params.id, input);
        res.json({ success: true, message: 'Workflow started' });
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to start workflow' });
    }
});
// ============================================================================
// Supervisor / Monitoring
// ============================================================================
/**
 * GET /shells/supervisor - Get supervisor view
 */
router.get('/supervisor', (req, res) => {
    const manager = getManager();
    res.json(manager.getSupervisorView());
});
/**
 * GET /shells/stats - Get manager statistics
 */
router.get('/stats', (req, res) => {
    const manager = getManager();
    res.json(manager.getStats());
});
/**
 * POST /shells/alerts/:id/acknowledge - Acknowledge alert
 */
router.post('/alerts/:id/acknowledge', (req, res) => {
    const manager = getManager();
    manager.acknowledgeAlert(req.params.id);
    res.json({ success: true });
});
/**
 * POST /shells/pause-all - Pause all shells
 */
router.post('/pause-all', (req, res) => {
    const manager = getManager();
    manager.pauseAll();
    res.json({ success: true, message: 'All shells paused' });
});
/**
 * POST /shells/resume-all - Resume all shells
 */
router.post('/resume-all', (req, res) => {
    const manager = getManager();
    manager.resumeAll();
    res.json({ success: true, message: 'All shells resumed' });
});
// ============================================================================
// n8n Webhook Integration
// ============================================================================
/**
 * POST /shells/webhook/n8n - n8n webhook endpoint
 */
router.post('/webhook/n8n', async (req, res) => {
    try {
        const manager = getManager();
        const result = await manager.handleN8nWebhook(req.body);
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Webhook failed' });
    }
});
// ============================================================================
// Export
// ============================================================================
export default router;
//# sourceMappingURL=shells.js.map