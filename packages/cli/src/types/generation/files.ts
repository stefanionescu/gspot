import type { Session } from '#cli/types/planning.ts';
import type { FileEdit } from '#cli/types/ownership.ts';
import type { ScopeSelection } from '#cli/types/settings/values.ts';
import type { BlockStyle } from '#cli/types/system/managed-blocks.ts';
import { type ReadCache, type FileContents } from '#cli/types/system/files.ts';
import type { IGNORE_SECTION_TITLES } from '#cli/config/generation/ignore-files.ts';
import type { RUNNERS, LFS_HOOKS, CHECK_HOOKS } from '#cli/config/generation/hooks.ts';
import type { Level, Manifest, ToolDeclaration, ToolFileDeclaration } from '#cli/types/configurations.ts';

type ManagedBlock = { path: string; block: string; style: BlockStyle };

type SemgrepRule = Record<string, unknown> & { id: string; paths?: { include: string[] } };

/** The repository and resolved scope for building tool files. */
type GenerationInputs = {
    session: Session;
    selection: ScopeSelection;
};

export type GeneratedFile = {
    path: string;
    content: string;
    executable?: boolean;
    read?: FileContents;
    kind?: 'lock' | 'tool_file' | 'tool_project' | 'pointer' | 'hook' | 'workflow' | 'rules';
};

export type GenerationResult = {
    notes: string[];
    files: GeneratedFile[];
    blocks: ManagedBlock[];
    fileEdits: FileEdit[];
};

/** The declaring configuration and the inputs of its scope. */
export type ToolFileInputs = GenerationInputs & { manifest: Manifest };

/** Generated tool files and the chosen target for each scope and declaration. */
export type ToolFileGeneration = {
    files: GeneratedFile[];
    targets: ReadonlyMap<string, ReadonlyMap<string, string>>;
};

/** The runner chosen from the gspot dependency of this repository. */
export type StartRunner = {
    name: keyof typeof RUNNERS;
    command: string;
    missing: string;
    pin: string;
};

export type PythonInputs = {
    pythonVenv: string | undefined;
    pythonScopePath: string;
    pythonExcludes: (check: string) => string[];
    ruffRules: string[];
};

export type ProseInputs = { words: string[] };

export type SemgrepDocument = { rules: SemgrepRule[] };

/** Typos dictionaries, whose values replace each declared word or identifier. */
export type TyposDictionary = {
    locale?: string;
    'extend-glob'?: string[];
    'extend-identifiers'?: Record<string, string>;
    'extend-words'?: Record<string, string>;
};

/** Typos extension tables. */
export type TyposSettings = { default?: TyposDictionary; type?: Record<string, TyposDictionary> };

export type HookName = (typeof CHECK_HOOKS)[number];

export type LfsHookName = (typeof LFS_HOOKS)[number];

export type NpmProjectInputs = {
    root: string;
    scopes: ScopeSelection[];
    manifests: Manifest[];
    /** Yarn 2 or later, which needs the settings that keep a node_modules folder. */
    isYarnBerry: boolean;
};

export type SwiftVersionInput = { root: string; scope: string; reads: ReadCache };

export type WholeToolFile = Extract<ToolFileDeclaration, { source: string }>;

/** The repository, scope, declaration, and destination for one whole tool file. */
export type ToolFileContext = ToolFileInputs & { targetPath: string; level: Level; toolFile: WholeToolFile };

/** Build a tool file's text from its resolved settings and declaration, including the final newline. */
export type ToolFileBuilder = (context: ToolFileContext) => string;

/** A tool and the generated destinations that can replace its package fields. */
export type PointerFieldInputs = {
    selection: ScopeSelection;
    manifest: Manifest;
    tool: ToolDeclaration;
    consumed: boolean;
    paths: ReadonlySet<string>;
    targets: ToolFileGeneration['targets'];
    scopePaths: string[];
};

/** One ignore group and the reason shown above its paths. */
export type IgnoreSection = { key: keyof typeof IGNORE_SECTION_TITLES | 'settings'; title: string; patterns: string[] };

/** A declaration paired with the repository and scope that own it. */
export type ToolFileSelection = { toolFile: ToolFileDeclaration; owner: ToolFileInputs };

/** A whole-file declaration with the text built for one scope. */
export type ToolFileContent = ToolFileSelection & { toolFile: WholeToolFile; file: GeneratedFile };

/** The mutable destinations and output files collected during one generation. */
export type ToolFileGenerationState = { targets: Map<string, Map<string, string>>; files: Map<string, GeneratedFile> };

/** The check and program names that make a tool-file declaration applicable. */
export type NeededToolFiles = { tools: Set<string>; checks: Set<string> };

/** A component file dialect, its parser, and syntax allowances. */
export type StylelintComponent = {
    files: readonly string[];
    customSyntax: string;
    ignorePseudoClasses: readonly string[];
    functions?: readonly string[];
};
