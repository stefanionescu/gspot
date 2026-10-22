import type { Session } from '#cli/types/session.ts';
import type { ManagedKeys } from '#cli/types/ownership.ts';
import type { FileContents } from '#cli/types/system/files.ts';
import type { Scope } from '#cli/types/settings/inheritance.ts';
import type { CHECK_HOOKS } from '#cli/config/generation/hooks.ts';
import type { BlockStyle } from '#cli/types/parsers/managed-blocks.ts';
import type { Tool, Level, ToolFile, Configuration } from '#cli/types/configurations.ts';
import type { IGNORE_SECTION_TITLES } from '#cli/config/generation/settings/ignore-files.ts';

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
    managedKeys: ManagedKeys[];
};

/** The configuration that declares the tool file, and its scope. */
export type ToolFileOwner = { session: Session; scope: Scope; configuration: Configuration };

/** Generated tool files and the chosen target for each scope and tool file. */
export type ToolFileGeneration = {
    files: GeneratedFile[];
    targets: ReadonlyMap<string, ReadonlyMap<string, string>>;
};

export type SemgrepDocument = { rules: SemgrepRule[] };

export type HookName = (typeof CHECK_HOOKS)[number];

export type PlannedNpmProject = {
    root: string;
    scopes: Scope[];
    configurations: Configuration[];
    /** Yarn 2 or later, which needs the settings that keep a node_modules folder. */
    isYarnBerry: boolean;
};

export type WholeToolFile = Extract<ToolFile, { source: string }>;

/** The repository, scope, tool file, and destination of one whole tool file. */
export type PlannedToolFile = ToolFileOwner & { targetPath: string; level: Level; toolFile: WholeToolFile };

/** Build the text of one tool file; buildToolFile adds the header and the final newline. */
export type ToolFileBuilder = (planned: PlannedToolFile) => string;

/** A tool and the generated destinations that can replace its package fields. */
export type PlannedPointerField = {
    scope: Scope;
    configuration: Configuration;
    tool: Tool;
    consumed: boolean;
    paths: ReadonlySet<string>;
    targets: ToolFileGeneration['targets'];
    scopePaths: string[];
};

/** One ignore group and the reason shown above its paths. */
export type IgnoreSection = { key: keyof typeof IGNORE_SECTION_TITLES | 'settings'; title: string; patterns: string[] };

/** A tool file paired with the repository and scope that own it. */
export type OwnedToolFile = { toolFile: ToolFile; owner: ToolFileOwner };

/** A whole tool file with the text built for one scope. */
export type BuiltToolFile = OwnedToolFile & { toolFile: WholeToolFile; file: GeneratedFile };

/** The mutable destinations and output files collected during one generation. */
export type GeneratedToolFiles = { targets: Map<string, Map<string, string>>; files: Map<string, GeneratedFile> };

/** The check and program names that make a tool file apply. */
export type UsedNames = { tools: Set<string>; checks: Set<string> };

/** A component file dialect, its parser, and the syntax it allows. */
export type StylelintComponent = {
    files: readonly string[];
    customSyntax: string;
    ignorePseudoClasses: readonly string[];
    functions?: readonly string[];
};
