import type { FileCopy } from '#cli/types/platform/root.ts';
import type { Manifest } from '#cli/types/configurations.ts';
import type { KeyChange } from '#cli/types/platform/document.ts';
import type { RuleSettings } from '#cli/types/generation/rules.ts';
import type { ScopeSelection } from '#cli/types/policy/settings.ts';
import type { TrackedFile } from '#cli/types/repository/inventory.ts';
import type { BlockStyle } from '#cli/types/platform/managed-blocks.ts';
import type { TemplateInputs } from '#cli/types/generation/templates.ts';

/** Applicable checks and their required tools at one generation boundary. */
export type ConfigurationConsumers = { tools: Set<string>; checks: Set<string> };

/** Repository-wide consumers and the consumers of the current scope. */
export type EmitConsumers = { repository: ConfigurationConsumers; scope: ConfigurationConsumers };

export type BlockOutput = { path: string; block: string; style: BlockStyle };

export type GeneratedFile = {
    ruleData?: RuleSettings;
    path: string;
    content: string;
    readOnly: boolean;
    executable?: boolean;
    read?: FileCopy;
    kind: 'lock' | 'config' | 'pointer' | 'hook' | 'runner' | 'workflow' | 'rules' | 'managed-block';
};

export type Generated = {
    notes: string[];
    files: GeneratedFile[];
    blocks: BlockOutput[];
    configurations: ConfigurationOutput[];
};

/** The repository and resolved scope whose configurations are generated. */
export type EmitInputs = {
    root: string;
    files: TrackedFile[];
    scopes: ScopeSelection[];
    inputs: TemplateInputs;
    selection: ScopeSelection;
};

/** The configuration owner within a scope's generation inputs. */
export type ConfigurationInputs = EmitInputs & { manifest: Manifest };

export type ConfigurationOutput = {
    path: string;
    changes: KeyChange[];
};
