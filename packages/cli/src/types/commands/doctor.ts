import type { ToolInspection } from '#cli/types/tools/inspection.ts';

type ConfigurationSuggestion = { configuration: string; evidence: string; command: string };

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
    environments: string[];
    suggestions: Suggestions;
    addCommands: string[];
    hooks: string;
    ci: string;
    ruleFiles: number;
    version: { running: string; pin?: string; installCommand?: string };
    exitCode: number;
};
