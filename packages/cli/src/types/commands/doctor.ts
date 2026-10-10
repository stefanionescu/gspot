import type { ToolInspection } from '#cli/types/tools/install.ts';
import type { ConfigurationSuggestion } from '#cli/types/configurations.ts';

export type SuggestionRow = { path: string; note: string; command: string };

export type Suggestions = {
    detected: ConfigurationSuggestion[];
    suggested: ConfigurationSuggestion[];
    undetected: ConfigurationSuggestion[];
    unowned: SuggestionRow[];
    authored: SuggestionRow[];
    duplicateMisePins: { tool: string; version: string; places: string[]; command: string }[];
};

export type DoctorReport = {
    submodules: string[];
    tools: ToolInspection[];
    suggestions: Suggestions;
    hooks: string;
    ci: string;
    rules: { files: number };
    version: { running: string; pinned?: string };
    exitCode: number;
};

export type SuggestionKey = 'detected' | 'suggested' | 'undetected' | 'unowned' | 'authored';

/** One suggestion category and the title printed in the doctor report. */
export type SuggestionSection = { key: SuggestionKey; title: string };
