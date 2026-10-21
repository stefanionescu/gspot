import type { ToolInspection } from '#cli/types/tools/inspection.ts';

/** A detected configuration absent from the saved selection, with its install command. */
type ConfigurationSuggestion = { configuration: string; evidence: string; command: string };

export type SuggestionRow = { path: string; note: string; command: string };

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
