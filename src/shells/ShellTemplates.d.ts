/**
 * ShellTemplates.ts - Pre-built AI Agent Templates
 *
 * Ready-to-use shell configurations for common use cases.
 * Users can create agents instantly from these templates.
 */
import type { ShellTemplate } from './ShellManager.js';
export declare const CoderShell: ShellTemplate;
export declare const CodeReviewerShell: ShellTemplate;
export declare const DebuggerShell: ShellTemplate;
export declare const ResearcherShell: ShellTemplate;
export declare const DataAnalystShell: ShellTemplate;
export declare const WriterShell: ShellTemplate;
export declare const TechnicalWriterShell: ShellTemplate;
export declare const PlannerShell: ShellTemplate;
export declare const ArchitectShell: ShellTemplate;
export declare const ExecutorShell: ShellTemplate;
export declare const AutomatorShell: ShellTemplate;
export declare const CommunicatorShell: ShellTemplate;
export declare const SupervisorShell: ShellTemplate;
export declare const QAShell: ShellTemplate;
export declare const AllTemplates: ShellTemplate[];
/**
 * Get template by ID
 */
export declare function getTemplate(id: string): ShellTemplate | undefined;
/**
 * Get templates by category
 */
export declare function getTemplatesByCategory(category: ShellTemplate['category']): ShellTemplate[];
/**
 * Get suggested team for a project type
 */
export declare function getSuggestedTeam(projectType: 'coding' | 'research' | 'content' | 'automation'): ShellTemplate[];
export default AllTemplates;
//# sourceMappingURL=ShellTemplates.d.ts.map