import type { Session } from '#cli/types/planning.ts';
import type { FileEdit } from '#cli/types/ownership.ts';
import type { HOOK_ARGS } from '#cli/config/generation/hooks.ts';
import type { ScopeSelection } from '#cli/types/settings/values.ts';
import type { TrackedFile } from '#cli/types/repository/inventory.ts';
import type { BlockStyle } from '#cli/types/system/managed-blocks.ts';
import { type FileCopy, type ReadCache } from '#cli/types/system/files.ts';
import type { PackageManager } from '#cli/types/parsers/dependency-files.ts';
import type { Manifest, ToolDeclaration, ToolFileDeclaration } from '#cli/types/configurations.ts';

/** Applicable checks and their required tools at one generation boundary. */
type ToolFileConsumers = { tools: Set<string>; checks: Set<string> };

type GeneratedBlock = { path: string; block: string; style: BlockStyle };

type SemgrepRule = Record<string, unknown> & { id: string; paths?: { include: string[] } };

/** Repository-wide consumers and the consumers of the current scope. */
export type EmitConsumers = { repository: ToolFileConsumers; scope: ToolFileConsumers };

export type GeneratedFile = {
    path: string;
    content: string;
    executable?: boolean;
    read?: FileCopy;
    kind: 'lock' | 'tool_file' | 'pointer' | 'hook' | 'workflow' | 'rules';
};

export type Generated = {
    notes: string[];
    files: GeneratedFile[];
    blocks: GeneratedBlock[];
    fileEdits: FileEdit[];
};

/** The repository and resolved scope for emit tool files. */
export type EmitInputs = {
    session: Session;
    manifests: Manifest[];
    files: TrackedFile[];
    scopes: ScopeSelection[];
    selection: ScopeSelection;
};

/** The configuration owner within a scope's generation inputs. */
export type ToolFileInputs = EmitInputs & { manifest: Manifest };

/** One proposed scoped output and its declaring configuration. */
export type ToolFileTarget = {
    toolFile: ToolFileDeclaration;
    target: string;
    owner: ToolFileInputs;
    pointers: GeneratedFile[];
};

/** The start command chosen from this repository's gspot dependency. */
export type StartRunner = {
    name: 'npm' | 'pnpm' | 'yarn' | 'bun' | 'mise';
    command: string;
    missing: string;
    pin: string;
};

/** Effective settings and declared project facts available to generated assets. */
export type ScopeSourceInputs = {
    session: Session;
    selection: ScopeSelection;
};

export type PythonInputs = {
    pythonVenv: string | undefined;
    pythonScopePath: string;
    pythonExcludes: (check: string) => string[];
    ruffRules: string[];
};

export type ProseInputs = { words: string[]; rules: string[] };

export type SemgrepDocument = { rules: SemgrepRule[] };

/** Native typos dictionaries, whose values replace each declared word or identifier. */
export type TyposDictionary = {
    locale?: string;
    'extend-glob'?: string[];
    'extend-identifiers'?: Record<string, string>;
    'extend-words'?: Record<string, string>;
};

/** Native typos extension tables. */
export type TyposSettings = { default?: TyposDictionary; type?: Record<string, TyposDictionary> };

export type HookName = keyof typeof HOOK_ARGS;

export type NpmProjectInputs = {
    root: string;
    scopes: ScopeSelection[];
    manifests: Manifest[];
    installer: PackageManager | undefined;
};

export type SwiftVersionInput = { root: string; scope: string; reads: ReadCache };

export type WholeToolFile = Extract<ToolFileDeclaration, { fragment: false }>;

/** A tool file producer selected by its declared target name. */
export type ToolFileBuilder = (input: EmitInputs & { targetPath: string }) => string;

/** A selected tool and the generated destinations that can replace package fields. */
export type PackageRedirectInputs = {
    selection: ScopeSelection;
    manifest: Manifest;
    tool: ToolDeclaration;
    consumed: boolean;
    paths: ReadonlySet<string>;
    scopePaths: string[];
};

/** The shared Vale destination, level, vocabulary, and captured rules. */
export type ValeIniInputs = {
    targetPath?: string;
    isAll: boolean;
    prose: ProseInputs;
};
