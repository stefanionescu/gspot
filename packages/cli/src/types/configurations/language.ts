import type { MessageFormatElement } from '@formatjs/icu-messageformat-parser';
import type { Node } from 'web-tree-sitter';
import type { z } from 'zod';

import type { DOCSTRING_STYLES } from '#cli/config/configurations/shared.ts';
import type { FENCE_GRAMMARS } from '#cli/config/parsers/code.ts';
import type { deptrySchema, xccovSchema } from '#cli/schemas/configurations.ts';
import type { settingsSchema } from '#cli/schemas/settings/file.ts';
import type { IgnoreSection, SourcedConfig } from '#cli/types/configurations/general.ts';
import type { CheckFinding } from '#cli/types/engine/run.ts';
import type { Config, Configuration } from '#cli/types/manifests.ts';
import type { ScriptSyntax } from '#cli/types/parsers.ts';
import type { Defined, Level, ParsedSettings, Scope } from '#cli/types/settings.ts';
import type { Files } from '#cli/types/system.ts';
import type { GeneratedFile, Session } from '#cli/types/tools.ts';

export type SitemapUrls = { urls: URL[]; findings: CheckFinding[] };

export type SiteBuild = {
    root: string;
    cwd: string;
    command: string[];
    folder: string;
    built: boolean;
    failure: string;
};

export type PurgecssConstructor = new () => {
    purge(options: Record<string, unknown>): Promise<Array<{ file?: string; rejected?: string[] }>>;
};

export type PurgecssRequest = { config: string; css: string[]; content: string[] };

export type AssetSource = { path: string; text: string; matches: (path: string) => boolean };

export type AssetGlobImport = { patterns: string[]; text: string };

export type LayoutFinding = { line: number; rule: string; message: string };

export type ScriptFile = ScriptSyntax & {
    path: string;
    lines: string[];
    executable: boolean;
};

export type MarkupAttribute = { name: string; value: string; element: string; node: Node };

export type FormatFenceParser = 'json' | 'jsonc' | 'toml' | 'yaml';

export type GrammarFenceParser = (typeof FENCE_GRAMMARS)[number];

export type FenceParser = FormatFenceParser | GrammarFenceParser;

export type FenceSyntaxError = { line: number; message: string };

export type DeptryProject = z.infer<typeof deptrySchema>;

export type PydoclintOptions = { command: string[]; style: PythonDocstringStyle | undefined };

export type PythonDocstringStyle = (typeof DOCSTRING_STYLES)[number];

type SwiftBuildPaths = {
    folder: string;
    log: string;
    store: string;
    commandArguments: string[];
    testArguments: string[];
};

export type SwiftBuildPlan = SwiftBuildPaths & ({ kind: 'package'; scratch: string } | { kind: 'xcode' });

export type SwiftBuildOutput = { code: number; output: string; source: string; files: Files };

export type SwiftBuildSetup = { files: Files; source: string };

export type CoverageOutput = z.infer<typeof xccovSchema>;

export type CoverageRun = CoverageOutput & { failures: CheckFinding[] };

export type MessageFiles = { folder: string; base: string; paths: ReadonlySet<string> };

export type ParsedMessage = { line: number; elements: MessageFormatElement[] | undefined; error: string | undefined };

export type BashCommandForm = {
    rule: string;
    message: string;
    present?: readonly RegExp[];
    absent?: RegExp;
    allLevel?: true;
};

export type ConfigOwner = { session: Session; scope: Scope; configuration: Configuration };

export type PlannedConfig = ConfigOwner & {
    ignoreSections: IgnoreSection[];
    targetPath: string;
    level: Level;
    config: SourcedConfig;
};

export type ConfigOutput = { content: string; companions: GeneratedFile[] };

export type StylelintComponent = {
    files: readonly string[];
    customSyntax: string;
    ignorePseudoClasses: readonly string[];
    functions?: readonly string[];
};

export type OwnedConfig = { config: Config; owner: ConfigOwner };

export type FormatSettings = Required<Defined<Omit<NonNullable<ParsedSettings['format']>, 'override' | 'quotes'>>> &
    Pick<NonNullable<ParsedSettings['format']>, 'quotes'>;

export type MarkdownlintFormatterInput = { results: unknown; logMessage: (message: string) => void };

export type WrittenSettings = z.input<typeof settingsSchema>;
