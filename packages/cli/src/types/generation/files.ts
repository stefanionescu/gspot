import type { Session } from '#cli/types/planning.ts';
import type { FileSettings } from '#cli/types/ownership.ts';
import { type FileContents } from '#cli/types/system/files.ts';
import type { ScopeSelection } from '#cli/types/settings/values.ts';
import type { BlockStyle } from '#cli/types/system/managed-blocks.ts';
import type { IGNORE_SECTION_TITLES } from '#cli/config/generation/ignore-files.ts';
import type { RUNNERS, LFS_HOOKS, CHECK_HOOKS } from '#cli/config/generation/hooks.ts';
import type { Level, Manifest, ToolDeclaration, ToolFileDeclaration } from '#cli/types/configurations.ts';

type ManagedBlock = { path: string; block: string; style: BlockStyle };

type SemgrepRule = Record<string, unknown> & { id: string; paths?: { include: string[] } };

export type GeneratedFile = {
    path: string;
    content: string;
    executable?: boolean;
    read?: FileContents | undefined;
    kind?: 'lock' | 'workflow';
};

export type GenerationResult = {
    files: GeneratedFile[];
    blocks: ManagedBlock[];
    fileSettings: FileSettings[];
};

/** The declaring configuration and the inputs of its scope. */
export type ToolFileInputs = { session: Session; selection: ScopeSelection; manifest: Manifest };

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

export type SemgrepDocument = { rules: SemgrepRule[] };

export type HookName = (typeof CHECK_HOOKS)[number];

export type LfsHookName = (typeof LFS_HOOKS)[number];

export type NpmProjectInputs = {
    root: string;
    scopes: ScopeSelection[];
    manifests: Manifest[];
    /** Yarn 2 or later, which needs the settings that keep a node_modules folder. */
    isYarnBerry: boolean;
};

export type WholeToolFile = Extract<ToolFileDeclaration, { source: string }>;

/** The repository, scope, declaration, and destination for one whole tool file. */
export type ToolFileContext = ToolFileInputs & { targetPath: string; level: Level; toolFile: WholeToolFile };

/** Build the text of one tool file; buildToolFile adds the header and the final newline. */
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
