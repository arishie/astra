import { Router, type Response } from 'express';
import { authenticate, type AuthenticatedRequest, rateLimit } from '../middleware/auth.js';
import { LanceManager } from '../../memory/LanceManager.js';
import * as path from 'path';
import * as fs from 'fs/promises';

const router = Router();

let memoryManager: LanceManager | null = null;

export function setMemoryManager(manager: LanceManager): void {
    memoryManager = manager;
}

// Initialize default memory manager if not set
async function getMemoryManager(): Promise<LanceManager> {
    if (!memoryManager) {
        memoryManager = new LanceManager();
        await memoryManager.initialize();
    }
    return memoryManager;
}

router.use(authenticate);

router.post('/ingest', rateLimit('ingest', 1), async (req: AuthenticatedRequest, res: Response) => {
    const { content, metadata = {}, type = 'text' } = req.body;

    if (!content || typeof content !== 'string') {
        res.status(400).json({
            error: 'Validation Error',
            message: 'Content is required and must be a string',
        });
        return;
    }

    if (content.length > 100000) {
        res.status(400).json({
            error: 'Validation Error',
            message: 'Content exceeds maximum length of 100000 characters',
        });
        return;
    }

    try {
        const manager = await getMemoryManager();

        // Chunk large content for better retrieval
        const chunks = chunkText(content, 1000, 200); // 1000 chars per chunk, 200 overlap
        const docId = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

        let chunkCount = 0;
        for (const chunk of chunks) {
            const chunkId = await manager.addMemory(
                chunk,
                {
                    ...metadata,
                    type,
                    documentId: docId,
                    chunkIndex: chunkCount,
                    totalChunks: chunks.length,
                },
                req.userId!
            );

            if (chunkId) chunkCount++;
        }

        res.json({
            id: docId,
            message: 'Document ingested successfully',
            type,
            chunkCount,
        });
    } catch (error) {
        console.error('[MemoryRoutes] Ingest error:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'Failed to ingest document',
        });
    }
});

// Helper function to chunk text with overlap
function chunkText(text: string, chunkSize: number, overlap: number): string[] {
    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
        const end = Math.min(start + chunkSize, text.length);
        chunks.push(text.slice(start, end));
        start = end - overlap;
        if (start + overlap >= text.length) break;
    }

    return chunks.length > 0 ? chunks : [text];
}

router.post('/ingest/file', rateLimit('ingest', 5), async (req: AuthenticatedRequest, res: Response) => {
    res.status(501).json({
        error: 'Not Implemented',
        message: 'File upload ingestion requires multipart form handling. Use /ingest with base64 content instead.',
    });
});

router.get('/search', rateLimit('chat', 1), async (req: AuthenticatedRequest, res: Response) => {
    const { query, limit = 10, threshold = 0.7 } = req.query;

    if (!query || typeof query !== 'string') {
        res.status(400).json({
            error: 'Validation Error',
            message: 'Search query is required',
        });
        return;
    }

    try {
        const manager = await getMemoryManager();
        const limitNum = Math.min(parseInt(limit as string) || 10, 50);
        const thresholdNum = parseFloat(threshold as string) || 0.7;

        const results = await manager.search(query, limitNum, req.userId!);

        // Filter by threshold if scores are available
        const filteredResults = results.filter(r =>
            r.score === undefined || r.score >= thresholdNum
        );

        res.json({
            results: filteredResults.map(r => ({
                id: r.id,
                text: r.text,
                metadata: r.metadata,
                score: r.score,
            })),
            query,
            count: filteredResults.length,
        });
    } catch (error) {
        console.error('[MemoryRoutes] Search error:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'Failed to search memory',
        });
    }
});

router.get('/stats', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const manager = await getMemoryManager();
        const stats = await manager.getUserStats(req.userId!);

        res.json({
            totalChunks: stats?.count || 0,
            tableName: stats?.tableName || 'not_created',
            userId: req.userId,
        });
    } catch (error) {
        console.error('[MemoryRoutes] Stats error:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'Failed to get memory stats',
        });
    }
});

router.delete('/', async (req: AuthenticatedRequest, res: Response) => {
    const { confirm } = req.body;

    if (confirm !== 'DELETE_ALL_MEMORY') {
        res.status(400).json({
            error: 'Confirmation Required',
            message: 'Set confirm to "DELETE_ALL_MEMORY" to clear all memory',
        });
        return;
    }

    try {
        const manager = await getMemoryManager();
        const statsBefore = await manager.getUserStats(req.userId!);
        const deletedCount = statsBefore?.count || 0;

        await manager.clearUserMemories(req.userId!);

        res.json({
            message: 'Memory cleared successfully',
            deletedCount,
        });
    } catch (error) {
        console.error('[MemoryRoutes] Delete error:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'Failed to clear memory',
        });
    }
});

router.delete('/:documentId', async (req: AuthenticatedRequest, res: Response) => {
    const { documentId } = req.params;

    if (!documentId || typeof documentId !== 'string') {
        res.status(400).json({
            error: 'Validation Error',
            message: 'Document ID is required',
        });
        return;
    }

    try {
        const manager = await getMemoryManager();
        const deleted = await manager.deleteMemory(documentId, req.userId!);

        if (!deleted) {
            res.status(404).json({
                error: 'Not Found',
                message: 'Document not found or already deleted',
            });
            return;
        }

        res.json({
            message: 'Document deleted successfully',
            documentId,
        });
    } catch (error) {
        console.error('[MemoryRoutes] Delete document error:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'Failed to delete document',
        });
    }
});

export default router;
