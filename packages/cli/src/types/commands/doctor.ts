import type { ToolInspection } from '#cli/types/tools/inspection.ts';

/** A configuration that doctor suggests to add or remove, the evidence for it, and the command that does it. */
type ConfigurationSuggestion = { configuration: string; evidence: string; command: string };

/** A file that doctor reports, what to know about it, and the command that fixes it, when one exists. */
export type SuggestionRow = { path: string; note: string; command?: string };

export type Suggestions = {
    detected: ConfigurationSuggestion[];
    suggested: ConfigurationSuggestion[];
    undetected: ConfigurationSuggestion[];
    unowned: SuggestionRow[];
    lintJobs: SuggestionRow[];
};

export type DoctorReport = {
    submodules: string[];
    tools: ToolInspection[];
    suggestions: Suggestions;
    hooks: string;
    ci: string;
    ruleFiles: number;
    version: { running: string; pinned?: string };
    exitCode: number;
};
