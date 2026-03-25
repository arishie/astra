// @ts-nocheck
/**
 * GhostCursor.ts - Visual Shadowing Mode (Ghost Cursor) Feature
 *
 * This module provides a comprehensive visual shadowing system that:
 * - Captures screen state at intervals
 * - Tracks cursor position and movements
 * - Creates a "ghost" overlay showing AI actions
 * - Supports playback of AI actions
 * - Allows users to see AI cursor movements in real-time
 */

import { EventEmitter } from 'events';
import { chromium, type Browser, type Page, type BrowserContext } from 'playwright';
import robot from 'robotjs';
import screenshot from 'screenshot-desktop';
import fs from 'fs';
import path from 'path';

// ============================================================================
// Type Definitions
// ============================================================================

/** Represents a 2D position on screen */
export interface Position {
    x: number;
    y: number;
}

/** Represents cursor state at a point in time */
export interface CursorState {
    position: Position;
    timestamp: number;
    isPressed: boolean;
    buttonType: 'left' | 'right' | 'middle' | 'none';
}

/** Types of actions that can be recorded */
export type ActionType =
    | 'move'
    | 'click'
    | 'doubleClick'
    | 'rightClick'
    | 'drag'
    | 'scroll'
    | 'type'
    | 'keyPress'
    | 'screenshot'
    | 'wait';

/** Represents a single recorded action */
export interface RecordedAction {
    id: string;
    type: ActionType;
    timestamp: number;
    position?: Position;
    endPosition?: Position;
    text?: string;
    key?: string;
    modifiers?: string[];
    scrollDelta?: { x: number; y: number };
    screenshotPath?: string;
    duration?: number;
    description: string;
    metadata?: Record<string, unknown>;
}

/** Recording session metadata */
export interface RecordingSession {
    id: string;
    name: string;
    startTime: number;
    endTime?: number;
    actions: RecordedAction[];
    screenResolution: { width: number; height: number };
    frameRate: number;
    metadata?: Record<string, unknown>;
}

/** Playback options */
export interface PlaybackOptions {
    speed: number;
    showGhostCursor: boolean;
    showActionOverlay: boolean;
    pauseOnError: boolean;
    stepMode: boolean;
    startFromAction?: number;
    endAtAction?: number;
}

/** Ghost overlay configuration */
export interface GhostOverlayConfig {
    cursorColor: string;
    cursorSize: number;
    trailEnabled: boolean;
    trailLength: number;
    trailColor: string;
    trailOpacity: number;
    actionLabelEnabled: boolean;
    actionLabelFont: string;
    actionLabelColor: string;
    clickIndicatorEnabled: boolean;
    clickIndicatorDuration: number;
}

/** Screen capture configuration */
export interface CaptureConfig {
    interval: number;
    quality: number;
    format: 'png' | 'jpg';
    region?: { x: number; y: number; width: number; height: number };
    includesCursor: boolean;
}

/** Playback state */
export interface PlaybackState {
    isPlaying: boolean;
    isPaused: boolean;
    currentActionIndex: number;
    elapsedTime: number;
    totalDuration: number;
    speed: number;
}

// ============================================================================
// GhostCursorTracker - Captures cursor state and movements
// ============================================================================

export class GhostCursorTracker extends EventEmitter {
    private isTracking: boolean = false;
    private trackingInterval: NodeJS.Timeout | null = null;
    private cursorHistory: CursorState[] = [];
    private maxHistorySize: number;
    private sampleRate: number;
    private lastPosition: Position | null = null;

    constructor(options: { maxHistorySize?: number; sampleRate?: number } = {}) {
        super();
        this.maxHistorySize = options.maxHistorySize ?? 10000;
        this.sampleRate = options.sampleRate ?? 60; // 60 samples per second
    }

    /**
     * Start tracking cursor position and state
     */
    public start(): void {
        if (this.isTracking) {
            console.warn('[GhostCursorTracker] Already tracking');
            return;
        }

        this.isTracking = true;
        const intervalMs = Math.floor(1000 / this.sampleRate);

        this.trackingInterval = setInterval(() => {
            this.captureCursorState();
        }, intervalMs);

        console.log(`[GhostCursorTracker] Started tracking at ${this.sampleRate} Hz`);
        this.emit('trackingStarted');
    }

    /**
     * Stop tracking cursor
     */
    public stop(): void {
        if (!this.isTracking) {
            return;
        }

        if (this.trackingInterval) {
            clearInterval(this.trackingInterval);
            this.trackingInterval = null;
        }

        this.isTracking = false;
        console.log('[GhostCursorTracker] Stopped tracking');
        this.emit('trackingStopped');
    }

    /**
     * Capture current cursor state
     */
    private captureCursorState(): void {
        try {
            const mousePos = robot.getMousePos();
            const currentPosition: Position = { x: mousePos.x, y: mousePos.y };

            // Detect if position changed (for movement events)
            const positionChanged = !this.lastPosition ||
                this.lastPosition.x !== currentPosition.x ||
                this.lastPosition.y !== currentPosition.y;

            const state: CursorState = {
                position: currentPosition,
                timestamp: Date.now(),
                isPressed: false, // robotjs doesn't provide button state directly
                buttonType: 'none'
            };

            this.cursorHistory.push(state);

            // Trim history if needed
            if (this.cursorHistory.length > this.maxHistorySize) {
                this.cursorHistory.shift();
            }

            if (positionChanged) {
                this.emit('cursorMoved', state);
            }

            this.lastPosition = currentPosition;
        } catch (error) {
            console.error('[GhostCursorTracker] Error capturing cursor state:', error);
        }
    }

    /**
     * Get current cursor position
     */
    public getCurrentPosition(): Position {
        const pos = robot.getMousePos();
        return { x: pos.x, y: pos.y };
    }

    /**
     * Get cursor history within a time range
     */
    public getHistory(startTime?: number, endTime?: number): CursorState[] {
        if (!startTime && !endTime) {
            return [...this.cursorHistory];
        }

        return this.cursorHistory.filter(state => {
            const afterStart = !startTime || state.timestamp >= startTime;
            const beforeEnd = !endTime || state.timestamp <= endTime;
            return afterStart && beforeEnd;
        });
    }

    /**
     * Clear cursor history
     */
    public clearHistory(): void {
        this.cursorHistory = [];
        this.emit('historyCleared');
    }

    /**
     * Get tracking status
     */
    public isActive(): boolean {
        return this.isTracking;
    }

    /**
     * Generate movement path for smooth animation
     */
    public generatePath(start: Position, end: Position, steps: number = 20): Position[] {
        const path: Position[] = [];

        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            // Use easing function for natural movement
            const easedT = this.easeInOutQuad(t);

            path.push({
                x: Math.round(start.x + (end.x - start.x) * easedT),
                y: Math.round(start.y + (end.y - start.y) * easedT)
            });
        }

        return path;
    }

    /**
     * Easing function for smooth cursor animation
     */
    private easeInOutQuad(t: number): number {
        return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    }
}

// ============================================================================
// ActionRecorder - Logs all AI interactions
// ============================================================================

export class ActionRecorder extends EventEmitter {
    private currentSession: RecordingSession | null = null;
    private isRecording: boolean = false;
    private screenshotDir: string;
    private captureConfig: CaptureConfig;
    private captureInterval: NodeJS.Timeout | null = null;
    private actionCounter: number = 0;

    constructor(options: {
        screenshotDir?: string;
        captureConfig?: Partial<CaptureConfig>
    } = {}) {
        super();
        this.screenshotDir = options.screenshotDir ?? 'ghost_recordings';
        this.captureConfig = {
            interval: 1000,
            quality: 80,
            format: 'png',
            includesCursor: true,
            ...options.captureConfig
        };

        this.ensureDirectoryExists();
    }

    /**
     * Ensure recording directory exists
     */
    private ensureDirectoryExists(): void {
        if (!fs.existsSync(this.screenshotDir)) {
            fs.mkdirSync(this.screenshotDir, { recursive: true });
        }
    }

    /**
     * Start a new recording session
     */
    public startSession(name: string, metadata?: Record<string, unknown>): RecordingSession {
        if (this.isRecording) {
            this.endSession();
        }

        const screenSize = robot.getScreenSize();

        this.currentSession = {
            id: this.generateId(),
            name,
            startTime: Date.now(),
            actions: [],
            screenResolution: { width: screenSize.width, height: screenSize.height },
            frameRate: Math.floor(1000 / this.captureConfig.interval),
            metadata
        };

        this.isRecording = true;
        this.actionCounter = 0;

        // Start periodic screenshot capture if configured
        if (this.captureConfig.interval > 0) {
            this.startScreenCapture();
        }

        console.log(`[ActionRecorder] Started session: ${name}`);
        this.emit('sessionStarted', this.currentSession);

        return this.currentSession;
    }

    /**
     * End current recording session
     */
    public endSession(): RecordingSession | null {
        if (!this.currentSession) {
            return null;
        }

        this.stopScreenCapture();
        this.currentSession.endTime = Date.now();
        this.isRecording = false;

        const session = this.currentSession;
        console.log(`[ActionRecorder] Ended session: ${session.name} (${session.actions.length} actions)`);
        this.emit('sessionEnded', session);

        this.currentSession = null;
        return session;
    }

    /**
     * Record an action
     */
    public recordAction(
        type: ActionType,
        details: Partial<Omit<RecordedAction, 'id' | 'type' | 'timestamp'>>
    ): RecordedAction | null {
        if (!this.isRecording || !this.currentSession) {
            console.warn('[ActionRecorder] Not recording - action not captured');
            return null;
        }

        const action: RecordedAction = {
            id: `${this.currentSession.id}_${++this.actionCounter}`,
            type,
            timestamp: Date.now(),
            description: details.description ?? this.generateDescription(type, details),
            ...details
        };

        this.currentSession.actions.push(action);
        this.emit('actionRecorded', action);

        return action;
    }

    /**
     * Record a mouse movement
     */
    public recordMove(position: Position, description?: string): RecordedAction | null {
        return this.recordAction('move', { position, description });
    }

    /**
     * Record a click action
     */
    public recordClick(
        position: Position,
        button: 'left' | 'right' = 'left',
        description?: string
    ): RecordedAction | null {
        const type: ActionType = button === 'right' ? 'rightClick' : 'click';
        return this.recordAction(type, { position, description });
    }

    /**
     * Record a double click action
     */
    public recordDoubleClick(position: Position, description?: string): RecordedAction | null {
        return this.recordAction('doubleClick', { position, description });
    }

    /**
     * Record a drag action
     */
    public recordDrag(
        startPosition: Position,
        endPosition: Position,
        description?: string
    ): RecordedAction | null {
        return this.recordAction('drag', {
            position: startPosition,
            endPosition,
            description
        });
    }

    /**
     * Record a scroll action
     */
    public recordScroll(
        position: Position,
        delta: { x: number; y: number },
        description?: string
    ): RecordedAction | null {
        return this.recordAction('scroll', {
            position,
            scrollDelta: delta,
            description
        });
    }

    /**
     * Record text typing
     */
    public recordType(text: string, position?: Position, description?: string): RecordedAction | null {
        return this.recordAction('type', { text, position, description });
    }

    /**
     * Record a key press
     */
    public recordKeyPress(
        key: string,
        modifiers?: string[],
        description?: string
    ): RecordedAction | null {
        return this.recordAction('keyPress', { key, modifiers, description });
    }

    /**
     * Record a wait/delay
     */
    public recordWait(duration: number, description?: string): RecordedAction | null {
        return this.recordAction('wait', { duration, description });
    }

    /**
     * Capture and record a screenshot
     */
    public async recordScreenshot(description?: string): Promise<RecordedAction | null> {
        if (!this.isRecording || !this.currentSession) {
            return null;
        }

        const filename = `screenshot_${Date.now()}.${this.captureConfig.format}`;
        const sessionDir = path.join(this.screenshotDir, this.currentSession.id);

        if (!fs.existsSync(sessionDir)) {
            fs.mkdirSync(sessionDir, { recursive: true });
        }

        const filepath = path.join(sessionDir, filename);

        try {
            await screenshot({ filename: filepath });
            return this.recordAction('screenshot', {
                screenshotPath: filepath,
                description
            });
        } catch (error) {
            console.error('[ActionRecorder] Failed to capture screenshot:', error);
            return null;
        }
    }

    /**
     * Start periodic screen capture
     */
    private startScreenCapture(): void {
        this.captureInterval = setInterval(async () => {
            await this.recordScreenshot('Periodic capture');
        }, this.captureConfig.interval);
    }

    /**
     * Stop periodic screen capture
     */
    private stopScreenCapture(): void {
        if (this.captureInterval) {
            clearInterval(this.captureInterval);
            this.captureInterval = null;
        }
    }

    /**
     * Get current session
     */
    public getCurrentSession(): RecordingSession | null {
        return this.currentSession;
    }

    /**
     * Check if currently recording
     */
    public isActive(): boolean {
        return this.isRecording;
    }

    /**
     * Save session to file
     */
    public async saveSession(session: RecordingSession, filepath?: string): Promise<string> {
        const savePath = filepath ?? path.join(
            this.screenshotDir,
            `${session.id}.json`
        );

        await fs.promises.writeFile(
            savePath,
            JSON.stringify(session, null, 2),
            'utf-8'
        );

        console.log(`[ActionRecorder] Session saved to: ${savePath}`);
        return savePath;
    }

    /**
     * Load session from file
     */
    public async loadSession(filepath: string): Promise<RecordingSession> {
        const content = await fs.promises.readFile(filepath, 'utf-8');
        return JSON.parse(content) as RecordingSession;
    }

    /**
     * Generate unique ID
     */
    private generateId(): string {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Generate action description
     */
    private generateDescription(
        type: ActionType,
        details: Partial<RecordedAction>
    ): string {
        switch (type) {
            case 'move':
                return `Move cursor to (${details.position?.x}, ${details.position?.y})`;
            case 'click':
                return `Click at (${details.position?.x}, ${details.position?.y})`;
            case 'doubleClick':
                return `Double-click at (${details.position?.x}, ${details.position?.y})`;
            case 'rightClick':
                return `Right-click at (${details.position?.x}, ${details.position?.y})`;
            case 'drag':
                return `Drag from (${details.position?.x}, ${details.position?.y}) to (${details.endPosition?.x}, ${details.endPosition?.y})`;
            case 'scroll':
                return `Scroll (${details.scrollDelta?.x}, ${details.scrollDelta?.y})`;
            case 'type':
                return `Type: "${details.text?.substring(0, 20)}${(details.text?.length ?? 0) > 20 ? '...' : ''}"`;
            case 'keyPress':
                const mods = details.modifiers?.join('+') ?? '';
                return `Key press: ${mods ? mods + '+' : ''}${details.key}`;
            case 'wait':
                return `Wait ${details.duration}ms`;
            case 'screenshot':
                return 'Capture screenshot';
            default:
                return `Action: ${type}`;
        }
    }
}

// ============================================================================
// GhostOverlay - Renders AI actions visually
// ============================================================================

export class GhostOverlay extends EventEmitter {
    private browser: Browser | null = null;
    private context: BrowserContext | null = null;
    private overlayPage: Page | null = null;
    private config: GhostOverlayConfig;
    private isVisible: boolean = false;
    private cursorTrail: Position[] = [];
    private clickIndicators: Array<{ position: Position; timestamp: number }> = [];

    constructor(config?: Partial<GhostOverlayConfig>) {
        super();
        this.config = {
            cursorColor: '#FF6B35',
            cursorSize: 20,
            trailEnabled: true,
            trailLength: 30,
            trailColor: '#FF6B35',
            trailOpacity: 0.3,
            actionLabelEnabled: true,
            actionLabelFont: '14px Arial',
            actionLabelColor: '#FFFFFF',
            clickIndicatorEnabled: true,
            clickIndicatorDuration: 500,
            ...config
        };
    }

    /**
     * Initialize the overlay browser window
     */
    public async initialize(): Promise<void> {
        if (this.browser) {
            console.warn('[GhostOverlay] Already initialized');
            return;
        }

        try {
            this.browser = await chromium.launch({
                headless: false,
                args: [
                    '--transparent',
                    '--disable-gpu',
                    '--no-sandbox',
                    '--enable-features=OverlayScrollbar'
                ]
            });

            this.context = await this.browser.newContext({
                viewport: null
            });

            this.overlayPage = await this.context.newPage();
            await this.setupOverlayPage();

            console.log('[GhostOverlay] Initialized successfully');
            this.emit('initialized');
        } catch (error) {
            console.error('[GhostOverlay] Failed to initialize:', error);
            throw error;
        }
    }

    /**
     * Setup the overlay page with canvas and styles
     */
    private async setupOverlayPage(): Promise<void> {
        if (!this.overlayPage) return;

        const screenSize = robot.getScreenSize();

        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                * { margin: 0; padding: 0; }
                body {
                    overflow: hidden;
                    background: transparent;
                    pointer-events: none;
                }
                #overlay-canvas {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100vw;
                    height: 100vh;
                    pointer-events: none;
                }
                #action-label {
                    position: fixed;
                    padding: 8px 12px;
                    background: rgba(0, 0, 0, 0.8);
                    color: ${this.config.actionLabelColor};
                    font: ${this.config.actionLabelFont};
                    border-radius: 4px;
                    pointer-events: none;
                    display: none;
                    z-index: 10000;
                }
                .click-indicator {
                    position: fixed;
                    width: 40px;
                    height: 40px;
                    border: 3px solid ${this.config.cursorColor};
                    border-radius: 50%;
                    animation: clickPulse ${this.config.clickIndicatorDuration}ms ease-out forwards;
                    pointer-events: none;
                    z-index: 9999;
                }
                @keyframes clickPulse {
                    0% { transform: translate(-50%, -50%) scale(0.5); opacity: 1; }
                    100% { transform: translate(-50%, -50%) scale(2); opacity: 0; }
                }
            </style>
        </head>
        <body>
            <canvas id="overlay-canvas" width="${screenSize.width}" height="${screenSize.height}"></canvas>
            <div id="action-label"></div>
        </body>
        </html>
        `;

        await this.overlayPage.setContent(html);
    }

    /**
     * Show the ghost overlay
     */
    public async show(): Promise<void> {
        if (!this.overlayPage) {
            await this.initialize();
        }
        this.isVisible = true;
        this.emit('shown');
    }

    /**
     * Hide the ghost overlay
     */
    public async hide(): Promise<void> {
        this.isVisible = false;
        if (this.overlayPage) {
            await this.clearCanvas();
        }
        this.emit('hidden');
    }

    /**
     * Render ghost cursor at position
     */
    public async renderCursor(position: Position): Promise<void> {
        if (!this.overlayPage || !this.isVisible) return;

        // Update trail
        this.cursorTrail.push(position);
        if (this.cursorTrail.length > this.config.trailLength) {
            this.cursorTrail.shift();
        }

        await this.overlayPage.evaluate(({ pos, trail, config }) => {
            const canvas = document.getElementById('overlay-canvas') as HTMLCanvasElement;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            // Clear canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Draw trail
            if (config.trailEnabled && trail.length > 1) {
                ctx.beginPath();
                ctx.moveTo(trail[0].x, trail[0].y);

                for (let i = 1; i < trail.length; i++) {
                    const opacity = (i / trail.length) * config.trailOpacity;
                    ctx.strokeStyle = `${config.trailColor}${Math.floor(opacity * 255).toString(16).padStart(2, '0')}`;
                    ctx.lineWidth = (i / trail.length) * config.cursorSize * 0.5;
                    ctx.lineTo(trail[i].x, trail[i].y);
                }
                ctx.stroke();
            }

            // Draw cursor
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, config.cursorSize / 2, 0, Math.PI * 2);
            ctx.fillStyle = config.cursorColor;
            ctx.fill();

            // Draw cursor outline
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, config.cursorSize / 2 + 2, 0, Math.PI * 2);
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 2;
            ctx.stroke();

        }, { pos: position, trail: this.cursorTrail, config: this.config });
    }

    /**
     * Show click indicator animation
     */
    public async showClickIndicator(position: Position): Promise<void> {
        if (!this.overlayPage || !this.isVisible || !this.config.clickIndicatorEnabled) {
            return;
        }

        await this.overlayPage.evaluate(({ x, y }) => {
            const indicator = document.createElement('div');
            indicator.className = 'click-indicator';
            indicator.style.left = `${x}px`;
            indicator.style.top = `${y}px`;
            document.body.appendChild(indicator);

            setTimeout(() => {
                indicator.remove();
            }, 500);
        }, position);
    }

    /**
     * Show action label
     */
    public async showActionLabel(text: string, position: Position): Promise<void> {
        if (!this.overlayPage || !this.isVisible || !this.config.actionLabelEnabled) {
            return;
        }

        await this.overlayPage.evaluate(({ label, pos }) => {
            const labelEl = document.getElementById('action-label');
            if (!labelEl) return;

            labelEl.textContent = label;
            labelEl.style.left = `${pos.x + 25}px`;
            labelEl.style.top = `${pos.y - 10}px`;
            labelEl.style.display = 'block';
        }, { label: text, pos: position });
    }

    /**
     * Hide action label
     */
    public async hideActionLabel(): Promise<void> {
        if (!this.overlayPage) return;

        await this.overlayPage.evaluate(() => {
            const labelEl = document.getElementById('action-label');
            if (labelEl) {
                labelEl.style.display = 'none';
            }
        });
    }

    /**
     * Clear the canvas
     */
    private async clearCanvas(): Promise<void> {
        if (!this.overlayPage) return;

        await this.overlayPage.evaluate(() => {
            const canvas = document.getElementById('overlay-canvas') as HTMLCanvasElement;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
        });

        this.cursorTrail = [];
    }

    /**
     * Update overlay configuration
     */
    public updateConfig(config: Partial<GhostOverlayConfig>): void {
        this.config = { ...this.config, ...config };
        this.emit('configUpdated', this.config);
    }

    /**
     * Get current configuration
     */
    public getConfig(): GhostOverlayConfig {
        return { ...this.config };
    }

    /**
     * Check if overlay is visible
     */
    public isShowing(): boolean {
        return this.isVisible;
    }

    /**
     * Cleanup and close overlay
     */
    public async destroy(): Promise<void> {
        if (this.context) {
            await this.context.close();
            this.context = null;
        }
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
        this.overlayPage = null;
        this.isVisible = false;
        this.cursorTrail = [];

        console.log('[GhostOverlay] Destroyed');
        this.emit('destroyed');
    }
}

// ============================================================================
// PlaybackEngine - Replays recorded sessions
// ============================================================================

export class PlaybackEngine extends EventEmitter {
    private cursorTracker: GhostCursorTracker;
    private overlay: GhostOverlay;
    private state: PlaybackState;
    private currentSession: RecordingSession | null = null;
    private playbackTimeout: NodeJS.Timeout | null = null;
    private options: PlaybackOptions;

    constructor(
        cursorTracker: GhostCursorTracker,
        overlay: GhostOverlay,
        options?: Partial<PlaybackOptions>
    ) {
        super();
        this.cursorTracker = cursorTracker;
        this.overlay = overlay;
        this.options = {
            speed: 1.0,
            showGhostCursor: true,
            showActionOverlay: true,
            pauseOnError: true,
            stepMode: false,
            ...options
        };

        this.state = {
            isPlaying: false,
            isPaused: false,
            currentActionIndex: 0,
            elapsedTime: 0,
            totalDuration: 0,
            speed: this.options.speed
        };
    }

    /**
     * Load a session for playback
     */
    public loadSession(session: RecordingSession): void {
        this.currentSession = session;
        this.state.currentActionIndex = this.options.startFromAction ?? 0;
        this.state.totalDuration = this.calculateDuration(session);
        this.state.elapsedTime = 0;

        console.log(`[PlaybackEngine] Loaded session: ${session.name}`);
        this.emit('sessionLoaded', session);
    }

    /**
     * Calculate total session duration
     */
    private calculateDuration(session: RecordingSession): number {
        if (session.actions.length === 0) return 0;

        const firstAction = session.actions[0];
        const lastAction = session.actions[session.actions.length - 1];

        return lastAction.timestamp - firstAction.timestamp;
    }

    /**
     * Start or resume playback
     */
    public async play(): Promise<void> {
        if (!this.currentSession) {
            throw new Error('No session loaded');
        }

        if (this.state.isPlaying && !this.state.isPaused) {
            console.warn('[PlaybackEngine] Already playing');
            return;
        }

        if (this.options.showGhostCursor) {
            await this.overlay.show();
        }

        this.state.isPlaying = true;
        this.state.isPaused = false;

        console.log('[PlaybackEngine] Playback started');
        this.emit('playbackStarted');

        await this.playNextAction();
    }

    /**
     * Play the next action in sequence
     */
    private async playNextAction(): Promise<void> {
        if (!this.currentSession || !this.state.isPlaying || this.state.isPaused) {
            return;
        }

        const endIndex = this.options.endAtAction ?? this.currentSession.actions.length;

        if (this.state.currentActionIndex >= endIndex) {
            await this.stop();
            return;
        }

        const action = this.currentSession.actions[this.state.currentActionIndex];
        const nextAction = this.currentSession.actions[this.state.currentActionIndex + 1];

        try {
            await this.executeAction(action);
            this.emit('actionPlayed', action, this.state.currentActionIndex);

            this.state.currentActionIndex++;

            // Calculate delay to next action
            if (nextAction && !this.options.stepMode) {
                const delay = (nextAction.timestamp - action.timestamp) / this.options.speed;
                this.playbackTimeout = setTimeout(() => {
                    this.playNextAction();
                }, Math.max(delay, 10));
            } else if (this.options.stepMode) {
                this.pause();
                this.emit('stepCompleted', action);
            } else {
                await this.stop();
            }
        } catch (error) {
            console.error(`[PlaybackEngine] Error executing action:`, error);
            this.emit('playbackError', error, action);

            if (this.options.pauseOnError) {
                this.pause();
            }
        }
    }

    /**
     * Execute a single action
     */
    private async executeAction(action: RecordedAction): Promise<void> {
        // Show action label if enabled
        if (this.options.showActionOverlay && action.position) {
            await this.overlay.showActionLabel(action.description, action.position);
        }

        switch (action.type) {
            case 'move':
                if (action.position) {
                    await this.animateMoveTo(action.position);
                }
                break;

            case 'click':
            case 'rightClick':
            case 'doubleClick':
                if (action.position) {
                    await this.animateMoveTo(action.position);
                    await this.overlay.showClickIndicator(action.position);

                    // Perform actual click in shadow mode (optional)
                    // robot.moveMouse(action.position.x, action.position.y);
                    // robot.mouseClick(action.type === 'rightClick' ? 'right' : 'left', action.type === 'doubleClick');
                }
                break;

            case 'drag':
                if (action.position && action.endPosition) {
                    await this.animateMoveTo(action.position);
                    await this.overlay.showClickIndicator(action.position);
                    await this.animateDrag(action.position, action.endPosition);
                }
                break;

            case 'scroll':
                // Visual indication of scroll
                if (action.position) {
                    await this.overlay.renderCursor(action.position);
                }
                break;

            case 'type':
                // Visual indication of typing
                if (action.position) {
                    await this.overlay.showActionLabel(`Typing: "${action.text}"`, action.position);
                }
                break;

            case 'keyPress':
                // Visual indication of key press
                const keyCombo = action.modifiers?.length
                    ? `${action.modifiers.join('+')}+${action.key}`
                    : action.key;
                await this.overlay.showActionLabel(`Key: ${keyCombo}`, action.position ?? { x: 100, y: 100 });
                break;

            case 'wait':
                await new Promise(resolve =>
                    setTimeout(resolve, (action.duration ?? 1000) / this.options.speed)
                );
                break;

            case 'screenshot':
                // Just show indication
                await this.overlay.showActionLabel('Screenshot captured', { x: 100, y: 100 });
                break;
        }

        // Hide action label after a short delay
        setTimeout(() => {
            this.overlay.hideActionLabel();
        }, 500);
    }

    /**
     * Animate cursor movement to position
     */
    private async animateMoveTo(target: Position): Promise<void> {
        const currentPos = this.cursorTracker.getCurrentPosition();
        const path = this.cursorTracker.generatePath(currentPos, target, 15);

        for (const pos of path) {
            if (!this.state.isPlaying || this.state.isPaused) break;
            await this.overlay.renderCursor(pos);
            await new Promise(resolve => setTimeout(resolve, 16 / this.options.speed));
        }
    }

    /**
     * Animate drag operation
     */
    private async animateDrag(start: Position, end: Position): Promise<void> {
        const path = this.cursorTracker.generatePath(start, end, 20);

        for (const pos of path) {
            if (!this.state.isPlaying || this.state.isPaused) break;
            await this.overlay.renderCursor(pos);
            await new Promise(resolve => setTimeout(resolve, 20 / this.options.speed));
        }

        await this.overlay.showClickIndicator(end);
    }

    /**
     * Pause playback
     */
    public pause(): void {
        if (!this.state.isPlaying) return;

        this.state.isPaused = true;

        if (this.playbackTimeout) {
            clearTimeout(this.playbackTimeout);
            this.playbackTimeout = null;
        }

        console.log('[PlaybackEngine] Playback paused');
        this.emit('playbackPaused');
    }

    /**
     * Resume playback
     */
    public async resume(): Promise<void> {
        if (!this.state.isPlaying || !this.state.isPaused) return;

        this.state.isPaused = false;
        console.log('[PlaybackEngine] Playback resumed');
        this.emit('playbackResumed');

        await this.playNextAction();
    }

    /**
     * Stop playback
     */
    public async stop(): Promise<void> {
        this.state.isPlaying = false;
        this.state.isPaused = false;

        if (this.playbackTimeout) {
            clearTimeout(this.playbackTimeout);
            this.playbackTimeout = null;
        }

        await this.overlay.hide();

        console.log('[PlaybackEngine] Playback stopped');
        this.emit('playbackStopped');
    }

    /**
     * Skip to a specific action
     */
    public async skipTo(actionIndex: number): Promise<void> {
        if (!this.currentSession) {
            throw new Error('No session loaded');
        }

        if (actionIndex < 0 || actionIndex >= this.currentSession.actions.length) {
            throw new Error('Invalid action index');
        }

        this.state.currentActionIndex = actionIndex;
        this.emit('skippedTo', actionIndex);

        if (this.state.isPlaying && !this.state.isPaused) {
            await this.playNextAction();
        }
    }

    /**
     * Step forward one action (in step mode)
     */
    public async stepForward(): Promise<void> {
        if (!this.currentSession) {
            throw new Error('No session loaded');
        }

        if (this.state.currentActionIndex >= this.currentSession.actions.length - 1) {
            await this.stop();
            return;
        }

        const wasPlaying = this.state.isPlaying;
        this.state.isPlaying = true;
        this.state.isPaused = false;

        await this.playNextAction();

        if (!wasPlaying) {
            this.state.isPlaying = false;
        }
    }

    /**
     * Step backward one action (in step mode)
     */
    public stepBackward(): void {
        if (this.state.currentActionIndex > 0) {
            this.state.currentActionIndex--;
            this.emit('steppedBackward', this.state.currentActionIndex);
        }
    }

    /**
     * Set playback speed
     */
    public setSpeed(speed: number): void {
        this.options.speed = Math.max(0.1, Math.min(10, speed));
        this.state.speed = this.options.speed;
        this.emit('speedChanged', this.options.speed);
    }

    /**
     * Get current playback state
     */
    public getState(): PlaybackState {
        return { ...this.state };
    }

    /**
     * Get current session
     */
    public getSession(): RecordingSession | null {
        return this.currentSession;
    }

    /**
     * Update playback options
     */
    public updateOptions(options: Partial<PlaybackOptions>): void {
        this.options = { ...this.options, ...options };
        this.emit('optionsUpdated', this.options);
    }
}

// ============================================================================
// GhostCursorManager - Main integration class
// ============================================================================

export class GhostCursorManager extends EventEmitter {
    private tracker: GhostCursorTracker;
    private recorder: ActionRecorder;
    private overlay: GhostOverlay;
    private playbackEngine: PlaybackEngine;
    private isInitialized: boolean = false;

    constructor(options?: {
        trackerOptions?: { maxHistorySize?: number; sampleRate?: number };
        recorderOptions?: { screenshotDir?: string; captureConfig?: Partial<CaptureConfig> };
        overlayConfig?: Partial<GhostOverlayConfig>;
        playbackOptions?: Partial<PlaybackOptions>;
    }) {
        super();

        this.tracker = new GhostCursorTracker(options?.trackerOptions);
        this.recorder = new ActionRecorder(options?.recorderOptions);
        this.overlay = new GhostOverlay(options?.overlayConfig);
        this.playbackEngine = new PlaybackEngine(
            this.tracker,
            this.overlay,
            options?.playbackOptions
        );

        this.setupEventForwarding();
    }

    /**
     * Forward events from sub-components
     */
    private setupEventForwarding(): void {
        // Forward tracker events
        this.tracker.on('trackingStarted', () => this.emit('trackingStarted'));
        this.tracker.on('trackingStopped', () => this.emit('trackingStopped'));
        this.tracker.on('cursorMoved', (state) => this.emit('cursorMoved', state));

        // Forward recorder events
        this.recorder.on('sessionStarted', (session) => this.emit('recordingStarted', session));
        this.recorder.on('sessionEnded', (session) => this.emit('recordingEnded', session));
        this.recorder.on('actionRecorded', (action) => this.emit('actionRecorded', action));

        // Forward playback events
        this.playbackEngine.on('playbackStarted', () => this.emit('playbackStarted'));
        this.playbackEngine.on('playbackStopped', () => this.emit('playbackStopped'));
        this.playbackEngine.on('playbackPaused', () => this.emit('playbackPaused'));
        this.playbackEngine.on('playbackResumed', () => this.emit('playbackResumed'));
        this.playbackEngine.on('actionPlayed', (action, index) => this.emit('actionPlayed', action, index));
        this.playbackEngine.on('playbackError', (error, action) => this.emit('playbackError', error, action));
    }

    /**
     * Initialize the ghost cursor system
     */
    public async initialize(): Promise<void> {
        if (this.isInitialized) {
            console.warn('[GhostCursorManager] Already initialized');
            return;
        }

        await this.overlay.initialize();
        this.isInitialized = true;

        console.log('[GhostCursorManager] System initialized');
        this.emit('initialized');
    }

    /**
     * Start tracking and recording
     */
    public startRecording(sessionName: string, metadata?: Record<string, unknown>): RecordingSession {
        this.tracker.start();
        return this.recorder.startSession(sessionName, metadata);
    }

    /**
     * Stop tracking and recording
     */
    public stopRecording(): RecordingSession | null {
        this.tracker.stop();
        return this.recorder.endSession();
    }

    /**
     * Record an action with tracking data
     */
    public recordAction(
        type: ActionType,
        details: Partial<Omit<RecordedAction, 'id' | 'type' | 'timestamp'>>
    ): RecordedAction | null {
        // If position not provided, use current cursor position
        if (!details.position && (type === 'click' || type === 'move' || type === 'doubleClick' || type === 'rightClick')) {
            details.position = this.tracker.getCurrentPosition();
        }

        return this.recorder.recordAction(type, details);
    }

    /**
     * Play back a recorded session
     */
    public async playSession(session: RecordingSession): Promise<void> {
        this.playbackEngine.loadSession(session);
        await this.playbackEngine.play();
    }

    /**
     * Play back from a saved file
     */
    public async playFromFile(filepath: string): Promise<void> {
        const session = await this.recorder.loadSession(filepath);
        await this.playSession(session);
    }

    /**
     * Save current or provided session
     */
    public async saveSession(session?: RecordingSession, filepath?: string): Promise<string> {
        const sessionToSave = session ?? this.recorder.getCurrentSession();
        if (!sessionToSave) {
            throw new Error('No session to save');
        }
        return this.recorder.saveSession(sessionToSave, filepath);
    }

    /**
     * Get the cursor tracker
     */
    public getTracker(): GhostCursorTracker {
        return this.tracker;
    }

    /**
     * Get the action recorder
     */
    public getRecorder(): ActionRecorder {
        return this.recorder;
    }

    /**
     * Get the overlay
     */
    public getOverlay(): GhostOverlay {
        return this.overlay;
    }

    /**
     * Get the playback engine
     */
    public getPlaybackEngine(): PlaybackEngine {
        return this.playbackEngine;
    }

    /**
     * Control playback
     */
    public pausePlayback(): void {
        this.playbackEngine.pause();
    }

    public async resumePlayback(): Promise<void> {
        await this.playbackEngine.resume();
    }

    public async stopPlayback(): Promise<void> {
        await this.playbackEngine.stop();
    }

    public setPlaybackSpeed(speed: number): void {
        this.playbackEngine.setSpeed(speed);
    }

    /**
     * Show ghost cursor overlay at position
     */
    public async showGhostAt(position: Position): Promise<void> {
        await this.overlay.show();
        await this.overlay.renderCursor(position);
    }

    /**
     * Hide ghost cursor overlay
     */
    public async hideGhost(): Promise<void> {
        await this.overlay.hide();
    }

    /**
     * Cleanup all resources
     */
    public async destroy(): Promise<void> {
        this.tracker.stop();
        this.recorder.endSession();
        await this.playbackEngine.stop();
        await this.overlay.destroy();
        this.isInitialized = false;

        console.log('[GhostCursorManager] System destroyed');
        this.emit('destroyed');
    }
}

// ============================================================================
// VisualAgent Integration Hook
// ============================================================================

/**
 * Hook to integrate GhostCursor with existing VisualAgent
 */
export function createVisualAgentHook(ghostManager: GhostCursorManager) {
    return {
        /**
         * Wrap a VisualAgent action to record it
         */
        wrapAction: async <T>(
            actionType: ActionType,
            action: () => Promise<T>,
            details?: Partial<RecordedAction>
        ): Promise<T> => {
            const position = ghostManager.getTracker().getCurrentPosition();

            // Record the action before execution
            ghostManager.recordAction(actionType, {
                position,
                ...details
            });

            // Show ghost cursor during action
            await ghostManager.showGhostAt(position);

            try {
                const result = await action();
                return result;
            } finally {
                // Brief delay before hiding to show action completion
                await new Promise(resolve => setTimeout(resolve, 200));
                await ghostManager.hideGhost();
            }
        },

        /**
         * Record a click with visual feedback
         */
        recordClick: async (x: number, y: number, description?: string) => {
            const position = { x, y };
            ghostManager.recordAction('click', { position, description });
            await ghostManager.showGhostAt(position);
            await ghostManager.getOverlay().showClickIndicator(position);
        },

        /**
         * Record cursor movement with trail
         */
        recordMove: async (x: number, y: number, description?: string) => {
            const position = { x, y };
            ghostManager.recordAction('move', { position, description });
            await ghostManager.getOverlay().renderCursor(position);
        },

        /**
         * Record text typing
         */
        recordType: (text: string, description?: string) => {
            ghostManager.recordAction('type', { text, description });
        },

        /**
         * Get recording session
         */
        getSession: () => ghostManager.getRecorder().getCurrentSession(),

        /**
         * Start/stop recording shortcuts
         */
        startRecording: (name: string) => ghostManager.startRecording(name),
        stopRecording: () => ghostManager.stopRecording()
    };
}

// ============================================================================
// Export all classes and utilities
// ============================================================================

export {
    GhostCursorTracker,
    ActionRecorder,
    GhostOverlay,
    PlaybackEngine,
    GhostCursorManager,
    createVisualAgentHook
};

// Default export for convenience
export default GhostCursorManager;
