import type { ToolInspection } from '#cli/types/tools/find.ts';
import type { ConfigurationSuggestion } from '#cli/types/repository/selection.ts';

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
