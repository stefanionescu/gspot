// What apply renders and writes: generated files, blocks, merges, package edits, the workflow and the hooks.
import type { Policy, MergedView } from '#types/config.ts';
import type { ScopeSelection, Session } from '#types/run.ts';
import type { ConfigurationTarget, Manifest } from '#types/manifest.ts';

export type GeneratedFile = {
    path: string;
    content: string;
    readOnly: boolean;
    executable?: boolean;
    kind: 'config' | 'stub' | 'hook' | 'runner' | 'workflow' | 'rules' | 'baseline' | 'version' | 'managed-block';
    preset?: string;
};

export type DriftEntry = {
    path: string;
    kind: 'changed' | 'missing' | 'stray';
    diff?: string;
};

export type HookName = 'pre-commit' | 'pre-push' | 'commit-msg';

export type BlockStyle = 'markdown' | 'hash';

export type ApplyReport = {
    written: string[];
    unchanged: string[];
    removed: string[];
    blocks: string[];
    packages: string[];
    notes: string[];
};

export type ApplyOptions = {
    cwd: string;
    check: boolean;
    lowerBaselines: boolean;
    projectTemplates: boolean;
    binaryPath?: string;
};

export type BlockOutput = { path: string; block: string; style: 'markdown' | 'hash' };

export type MergeOutput = {
    path: string;
    content: string;
    keys: string[];
    target: string;
    stub: ConfigurationTarget['stub'] & object;
};

export type PackageOutput = { path: string; devDependencies: Record<string, string>; scripts: Record<string, string> };

export type LefthookOutput = { path: string; block: LefthookBlock };

export type RenderedSet = {
    files: GeneratedFile[];
    blocks: BlockOutput[];
    merges: MergeOutput[];
    packages: PackageOutput[];
    lefthook?: LefthookOutput;
};

export type TemplateInputs = {
    prose: { packages: string[]; blockIgnores: string[]; tokenIgnores: string[]; disabledUpstream: [string, string][] };
    version: string;
    scope: string;
    scopes: { path: string; presets: string[] }[];
    presets: string[];
    policy: Policy;
    view: MergedView;
    format: MergedView['format'];
    settings: Record<string, unknown>;
    fragments: string;
    tool: (name: string) => Record<string, unknown>;
    toolEnabled: (name: string) => boolean;
    limit: (key: string, language?: string) => number | undefined;
    rulesOff: (check: string) => string[];
    ignoresFor: MergedView['ignoresFor'];
    extra: (name: string) => Record<string, unknown> | undefined;
    json: (value: unknown, indent?: number) => string;
    tomlString: (value: string) => string;
    has: (preset: string) => boolean;
    files: (extension: string) => string[];
    importAliases: (scope: string) => Record<string, string>;
    tools: string[];
    header: string;
    headerLines: string[];
};

/** The part of package.json the alias reader looks at. */
export type PackageImports = { imports?: Record<string, unknown> };

/** The part of tsconfig.json the alias reader looks at. */
export type TsconfigPaths = { compilerOptions?: { paths?: Record<string, string[]> } };

/** The part of package.json apply reads and writes. */
export type PackageContent = { devDependencies?: Record<string, string>; scripts?: Record<string, string> };

/** What rendering one manifest's files in one scope needs. */
export type EmitContext = { session: Session; selection: ScopeSelection; manifest: Manifest };

/** What the workflow emitter needs to know. */
export type WorkflowShape = {
    version: string;
    platforms: string[];
    /** The Swift scope path, or undefined when no scope selects swift. */
    swiftScope: string | undefined;
    isMise: boolean;
};

/** How generated JSON is laid out: the Prettier print width and indent width. */
export type JsonFormat = { width: number; indent: number };

/** The hook commands lefthook.yml carries per hook. */
export type LefthookBlock = Record<string, { commands: Record<string, unknown> }>;
