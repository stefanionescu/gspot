// Tool analyses choose project-aware commands while preserving the shared runner.
import type { ToolAnalysis } from '#types/run.ts';
import { checkTypescript } from '#cli/integrity/tsc.ts';

export const TOOL_ANALYSES: Partial<Record<string, ToolAnalysis>> = { typescript: checkTypescript };
