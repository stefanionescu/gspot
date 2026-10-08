import type { FileCopy } from '#cli/types/platform/root.ts';
import type { Manifest } from '#cli/types/configurations.ts';
import type { EtaInputs } from '#cli/types/generation/eta.ts';
import type { KeyChange } from '#cli/types/parsers/document.ts';
import type { CapturedRules } from '#cli/types/generation/rules.ts';
import type { ScopeSelection } from '#cli/types/policy/settings.ts';
import type { TrackedFile } from '#cli/types/repository/inventory.ts';
import type { BlockStyle } from '#cli/types/platform/managed-blocks.ts';

/** Applicable checks and their required tools at one generation boundary. */
export type ToolFileConsumers = { tools: Set<string>; checks: Set<string> };

/** Repository-wide consumers and the consumers of the current scope. */
export type EmitConsumers = { repository: ToolFileConsumers; scope: ToolFileConsumers };

export type GeneratedBlock = { path: string; block: string; style: BlockStyle };

export type GeneratedFile = {
    ruleData?: CapturedRules;
    path: string;
    content: string;
    executable?: boolean;
    read?: FileCopy;
    kind: 'lock' | 'tool_file' | 'pointer' | 'hook' | 'runner' | 'workflow' | 'rules';
};

export type Generated = {
    notes: string[];
    files: GeneratedFile[];
    blocks: GeneratedBlock[];
    toolFiles: EmittedToolFile[];
};

/** The repository and resolved scope whose configurations are generated. */
export type EmitInputs = {
    root: string;
    files: TrackedFile[];
    scopes: ScopeSelection[];
    inputs: EtaInputs;
    selection: ScopeSelection;
};

/** The configuration owner within a scope's generation inputs. */
export type ToolFileInputs = EmitInputs & { manifest: Manifest };

export type EmittedToolFile = {
    path: string;
    changes: KeyChange[];
};
