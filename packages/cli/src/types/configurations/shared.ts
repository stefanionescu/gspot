import type { RunCache } from '#cli/types/system.ts';
import type { Level, Scope } from '#cli/types/settings.ts';
import type { Session, GeneratedFile } from '#cli/types/tools.ts';
import type { Substitutions } from '#cli/types/engine/tool-runs.ts';
import type { Check, Config, Configuration } from '#cli/types/manifests.ts';
import type { IGNORE_SECTION_TITLES } from '#cli/config/configurations/shared.ts';
import type { SqlStatement, SqlNodeFields, ParsedTsconfig } from '#cli/types/parsers.ts';

export type ConfigOwner = { session: Session; scope: Scope; configuration: Configuration };

export type PlannedConfig = ConfigOwner & {
    ignoreSections: IgnoreSection[];
    targetPath: string;
    level: Level;
    config: SourcedConfig;
};

export type ConfigOutput = { content: string; companions: GeneratedFile[] };

export type GeneratorRun = {
    substitutions: Substitutions;
    commandText: string;
    declaration: string[];
    patterns: string[];
    named: string[];
    targets: GeneratorOutput[];
    selected: string[];
};

export type TypeScriptReferenceCopy = {
    root: string;
    copyRoot: string;
    cache: RunCache;
    projects: Map<string, ParsedTsconfig>;
};

export type RuleOptionsRun = {
    configured: string[];
    running: ReadonlySet<string>;
    allLevelRules: ReadonlySet<string>;
    level: Level;
};

export type ConfigBuilder = (planned: PlannedConfig) => string | ConfigOutput;

export type IgnoreSection = { key: keyof typeof IGNORE_SECTION_TITLES | 'settings'; title: string; patterns: string[] };

export type SourcedConfig = Extract<Config, { source: string }>;

export type GeneratorOutput = NonNullable<Check['generator_outputs']>[number];

export type SqlStatementVisitors<Result, Arguments extends unknown[] = []> = {
    [Kind in keyof SqlNodeFields]?: (statement: SqlStatement<Kind>, ...readerArguments: Arguments) => Result;
};
