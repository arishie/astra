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
export type ActionType = 'move' | 'click' | 'doubleClick' | 'rightClick' | 'drag' | 'scroll' | 'type' | 'keyPress' | 'screenshot' | 'wait';
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
    scrollDelta?: {
        x: number;
        y: number;
    };
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
    screenResolution: {
        width: number;
        height: number;
    };
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
    region?: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
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
export declare class GhostCursorTracker extends EventEmitter {
    private isTracking;
    private trackingInterval;
    private cursorHistory;
    private maxHistorySize;
    private sampleRate;
    private lastPosition;
    constructor(options?: {
        maxHistorySize?: number;
        sampleRate?: number;
    });
    /**
     * Start tracking cursor position and state
     */
    start(): void;
    /**
     * Stop tracking cursor
     */
    stop(): void;
    /**
     * Capture current cursor state
     */
    private captureCursorState;
    /**
     * Get current cursor position
     */
    getCurrentPosition(): Position;
    /**
     * Get cursor history within a time range
     */
    getHistory(startTime?: number, endTime?: number): CursorState[];
    /**
     * Clear cursor history
     */
    clearHistory(): void;
    /**
     * Get tracking status
     */
    isActive(): boolean;
    /**
     * Generate movement path for smooth animation
     */
    generatePath(start: Position, end: Position, steps?: number): Position[];
    /**
     * Easing function for smooth cursor animation
     */
    private easeInOutQuad;
}
export declare class ActionRecorder extends EventEmitter {
    private currentSession;
    private isRecording;
    private screenshotDir;
    private captureConfig;
    private captureInterval;
    private actionCounter;
    constructor(options?: {
        screenshotDir?: string;
        captureConfig?: Partial<CaptureConfig>;
    });
    /**
     * Ensure recording directory exists
     */
    private ensureDirectoryExists;
    /**
     * Start a new recording session
     */
    startSession(name: string, metadata?: Record<string, unknown>): RecordingSession;
    /**
     * End current recording session
     */
    endSession(): RecordingSession | null;
    /**
     * Record an action
     */
    recordAction(type: ActionType, details: Partial<Omit<RecordedAction, 'id' | 'type' | 'timestamp'>>): RecordedAction | null;
    /**
     * Record a mouse movement
     */
    recordMove(position: Position, description?: string): RecordedAction | null;
    /**
     * Record a click action
     */
    recordClick(position: Position, button?: 'left' | 'right', description?: string): RecordedAction | null;
    /**
     * Record a double click action
     */
    recordDoubleClick(position: Position, description?: string): RecordedAction | null;
    /**
     * Record a drag action
     */
    recordDrag(startPosition: Position, endPosition: Position, description?: string): RecordedAction | null;
    /**
     * Record a scroll action
     */
    recordScroll(position: Position, delta: {
        x: number;
        y: number;
    }, description?: string): RecordedAction | null;
    /**
     * Record text typing
     */
    recordType(text: string, position?: Position, description?: string): RecordedAction | null;
    /**
     * Record a key press
     */
    recordKeyPress(key: string, modifiers?: string[], description?: string): RecordedAction | null;
    /**
     * Record a wait/delay
     */
    recordWait(duration: number, description?: string): RecordedAction | null;
    /**
     * Capture and record a screenshot
     */
    recordScreenshot(description?: string): Promise<RecordedAction | null>;
    /**
     * Start periodic screen capture
     */
    private startScreenCapture;
    /**
     * Stop periodic screen capture
     */
    private stopScreenCapture;
    /**
     * Get current session
     */
    getCurrentSession(): RecordingSession | null;
    /**
     * Check if currently recording
     */
    isActive(): boolean;
    /**
     * Save session to file
     */
    saveSession(session: RecordingSession, filepath?: string): Promise<string>;
    /**
     * Load session from file
     */
    loadSession(filepath: string): Promise<RecordingSession>;
    /**
     * Generate unique ID
     */
    private generateId;
    /**
     * Generate action description
     */
    private generateDescription;
}
export declare class GhostOverlay extends EventEmitter {
    private browser;
    private context;
    private overlayPage;
    private config;
    private isVisible;
    private cursorTrail;
    private clickIndicators;
    constructor(config?: Partial<GhostOverlayConfig>);
    /**
     * Initialize the overlay browser window
     */
    initialize(): Promise<void>;
    /**
     * Setup the overlay page with canvas and styles
     */
    private setupOverlayPage;
    /**
     * Show the ghost overlay
     */
    show(): Promise<void>;
    /**
     * Hide the ghost overlay
     */
    hide(): Promise<void>;
    /**
     * Render ghost cursor at position
     */
    renderCursor(position: Position): Promise<void>;
    /**
     * Show click indicator animation
     */
    showClickIndicator(position: Position): Promise<void>;
    /**
     * Show action label
     */
    showActionLabel(text: string, position: Position): Promise<void>;
    /**
     * Hide action label
     */
    hideActionLabel(): Promise<void>;
    /**
     * Clear the canvas
     */
    private clearCanvas;
    /**
     * Update overlay configuration
     */
    updateConfig(config: Partial<GhostOverlayConfig>): void;
    /**
     * Get current configuration
     */
    getConfig(): GhostOverlayConfig;
    /**
     * Check if overlay is visible
     */
    isShowing(): boolean;
    /**
     * Cleanup and close overlay
     */
    destroy(): Promise<void>;
}
export declare class PlaybackEngine extends EventEmitter {
    private cursorTracker;
    private overlay;
    private state;
    private currentSession;
    private playbackTimeout;
    private options;
    constructor(cursorTracker: GhostCursorTracker, overlay: GhostOverlay, options?: Partial<PlaybackOptions>);
    /**
     * Load a session for playback
     */
    loadSession(session: RecordingSession): void;
    /**
     * Calculate total session duration
     */
    private calculateDuration;
    /**
     * Start or resume playback
     */
    play(): Promise<void>;
    /**
     * Play the next action in sequence
     */
    private playNextAction;
    /**
     * Execute a single action
     */
    private executeAction;
    /**
     * Animate cursor movement to position
     */
    private animateMoveTo;
    /**
     * Animate drag operation
     */
    private animateDrag;
    /**
     * Pause playback
     */
    pause(): void;
    /**
     * Resume playback
     */
    resume(): Promise<void>;
    /**
     * Stop playback
     */
    stop(): Promise<void>;
    /**
     * Skip to a specific action
     */
    skipTo(actionIndex: number): Promise<void>;
    /**
     * Step forward one action (in step mode)
     */
    stepForward(): Promise<void>;
    /**
     * Step backward one action (in step mode)
     */
    stepBackward(): void;
    /**
     * Set playback speed
     */
    setSpeed(speed: number): void;
    /**
     * Get current playback state
     */
    getState(): PlaybackState;
    /**
     * Get current session
     */
    getSession(): RecordingSession | null;
    /**
     * Update playback options
     */
    updateOptions(options: Partial<PlaybackOptions>): void;
}
export declare class GhostCursorManager extends EventEmitter {
    private tracker;
    private recorder;
    private overlay;
    private playbackEngine;
    private isInitialized;
    constructor(options?: {
        trackerOptions?: {
            maxHistorySize?: number;
            sampleRate?: number;
        };
        recorderOptions?: {
            screenshotDir?: string;
            captureConfig?: Partial<CaptureConfig>;
        };
        overlayConfig?: Partial<GhostOverlayConfig>;
        playbackOptions?: Partial<PlaybackOptions>;
    });
    /**
     * Forward events from sub-components
     */
    private setupEventForwarding;
    /**
     * Initialize the ghost cursor system
     */
    initialize(): Promise<void>;
    /**
     * Start tracking and recording
     */
    startRecording(sessionName: string, metadata?: Record<string, unknown>): RecordingSession;
    /**
     * Stop tracking and recording
     */
    stopRecording(): RecordingSession | null;
    /**
     * Record an action with tracking data
     */
    recordAction(type: ActionType, details: Partial<Omit<RecordedAction, 'id' | 'type' | 'timestamp'>>): RecordedAction | null;
    /**
     * Play back a recorded session
     */
    playSession(session: RecordingSession): Promise<void>;
    /**
     * Play back from a saved file
     */
    playFromFile(filepath: string): Promise<void>;
    /**
     * Save current or provided session
     */
    saveSession(session?: RecordingSession, filepath?: string): Promise<string>;
    /**
     * Get the cursor tracker
     */
    getTracker(): GhostCursorTracker;
    /**
     * Get the action recorder
     */
    getRecorder(): ActionRecorder;
    /**
     * Get the overlay
     */
    getOverlay(): GhostOverlay;
    /**
     * Get the playback engine
     */
    getPlaybackEngine(): PlaybackEngine;
    /**
     * Control playback
     */
    pausePlayback(): void;
    resumePlayback(): Promise<void>;
    stopPlayback(): Promise<void>;
    setPlaybackSpeed(speed: number): void;
    /**
     * Show ghost cursor overlay at position
     */
    showGhostAt(position: Position): Promise<void>;
    /**
     * Hide ghost cursor overlay
     */
    hideGhost(): Promise<void>;
    /**
     * Cleanup all resources
     */
    destroy(): Promise<void>;
}
/**
 * Hook to integrate GhostCursor with existing VisualAgent
 */
export declare function createVisualAgentHook(ghostManager: GhostCursorManager): {
    /**
     * Wrap a VisualAgent action to record it
     */
    wrapAction: <T>(actionType: ActionType, action: () => Promise<T>, details?: Partial<RecordedAction>) => Promise<T>;
    /**
     * Record a click with visual feedback
     */
    recordClick: (x: number, y: number, description?: string) => Promise<void>;
    /**
     * Record cursor movement with trail
     */
    recordMove: (x: number, y: number, description?: string) => Promise<void>;
    /**
     * Record text typing
     */
    recordType: (text: string, description?: string) => void;
    /**
     * Get recording session
     */
    getSession: () => RecordingSession | null;
    /**
     * Start/stop recording shortcuts
     */
    startRecording: (name: string) => RecordingSession;
    stopRecording: () => RecordingSession | null;
};
export { GhostCursorTracker, ActionRecorder, GhostOverlay, PlaybackEngine, GhostCursorManager, createVisualAgentHook };
export default GhostCursorManager;
//# sourceMappingURL=GhostCursor.d.ts.map