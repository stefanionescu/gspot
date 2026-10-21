import { parse } from '@decimalturn/toml-patch';
import { planChecks } from '#cli/planning/checks.ts';
import type { Session } from '#cli/types/session.ts';
import { parseSettings } from '#cli/settings/read.ts';
import { readRepository } from '#cli/repository/read.ts';
import type { RunOptions } from '#cli/types/runs/run.ts';
import { SETTINGS_FILE } from '#cli/config/gspot-paths.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { buildKnownSettings } from '#cli/settings/known.ts';
import { selectForScope } from '#cli/settings/scope-view.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import type { SampleChanges } from '#tests/types/samples.ts';
import { SETTING_FACTS } from '#cli/config/settings/facts.ts';
import { buildPathMatcher } from '#cli/repository/matchers.ts';
import { getTool } from '#cli/configurations/declared-tools.ts';
import type { NamingCase } from '#cli/types/settings/tables.ts';
import type { ToolSearch } from '#cli/types/tools/inspection.ts';
import { SOURCE_KIND } from '#cli/config/repository/inventory.ts';
import type { SpawnResult } from '#cli/types/system/processes.ts';
import { buildRootScopeSettings } from '#tests/setup/settings.ts';
import { readNamingSettings } from '#cli/checks/naming/settings.ts';
import { manifestSchema } from '#cli/schemas/configurations/manifest.ts';
import type { Repository, TrackedFile } from '#cli/types/repository/inventory.ts';
import { listChecksById, readConfigurations } from '#cli/configurations/manifests.ts';
import { type Tool, type Check, type Configuration } from '#cli/types/configurations.ts';
import type { FileNaming, Identifier, NamingSettings } from '#cli/types/checks/naming.ts';
import { NAMING_TEST_LIMITS, NAMING_TEST_SETTINGS } from '#tests/data/checks/naming/settings.ts';

/**
 * List the shipped configurations that gspot selects in every repository.
 *
 * @returns their names.
 */
export function listAlwaysSelected(): string[] {
    return [...readConfigurations().values()]
        .filter((configuration) => configuration.always_selected)
        .map((configuration) => configuration.name);
}

/** The init arguments for a test run without prompts. */
export function buildInitArguments(configurations: readonly string[], options: { json?: boolean } = {}): string[] {
    return [
        'init',
        '--yes',
        ...(configurations.length === 0 ? [] : ['--configurations', ...configurations]),
        ...(options.json === true ? ['--json'] : []),
    ];
}

/** A process result for check tests, with these fields changed. */
export function buildProcessResult(overrides: Partial<SpawnResult> = {}): SpawnResult {
    return {
        timedOut: false,
        canceled: false,
        errored: false,
        code: 0,
        stdout: '',
        stderr: '',
        missing: false,
        duration: 1,
        ...overrides,
    };
}

/**
 * A program pin, with an npm installer when npm names a package.
 *
 * @param name executable to pin.
 * @param version release to pin.
 * @param npm package that ships the program.
 * @returns a tool record with that program pinned.
 */
export function buildProgramPin(name: string, version: string, npm?: string): Tool {
    return {
        name,
        kind: 'program',
        version,
        installers: npm === undefined ? {} : { npm: { name: npm, version } },
    };
}

/**
 * Parse a configuration manifest for one test.
 *
 * @param name what to call the configuration.
 * @param fields extra manifest tables and fields.
 * @param fields.requires configurations that it needs.
 * @param fields.tables extra TOML for the manifest.
 * @param fields.group where the configuration sits.
 * @returns the configuration with resolved tools.
 */
export function buildConfiguration(
    name: string,
    fields: { requires?: string[]; tables?: string; group?: Configuration['group'] } = {},
): Configuration {
    const parsed = manifestSchema.parse({
        ...parse(fields.tables ?? ''),
        folder: `configurations/${fields.group ?? 'language'}/${name}`,
        configuration: {
            name,
            title: name,
            group: fields.group ?? 'language',
            requires: fields.requires ?? [],
            description: 'A configuration for the tests, long enough.',
        },
    });
    const { configuration, tools, ...rest } = parsed;
    return {
        ...rest,
        ...configuration,
        tools: tools.map((tool) => (typeof tool === 'string' ? getTool(readConfigurations().values(), tool) : tool)),
    };
}

/**
 * Options for an in-process run of every stage, with no fixes.
 *
 * @param overrides what the test changes.
 * @returns the defaults with the overrides applied.
 */
export function buildRunOptions(overrides: Partial<RunOptions>): RunOptions {
    return { stage: 'all', fix: false, isDryRun: false, ...overrides };
}

/**
 * One tracked source file of one byte with no captured prefix.
 *
 * @param path location from the repository root.
 * @param tags labels that the file extension gives.
 * @returns a one-byte source file for the inventory.
 */
export function buildTrackedFile(path: string, tags: string[] = ['text']): TrackedFile {
    return { path, kind: 'source', kindOrigin: SOURCE_KIND.origin, tags, executable: false, size: 1 };
}

/**
 * The planned fixer of the sandbox with its command replaced by a script.
 *
 * @param session the open sandbox.
 * @param script JavaScript for the fixer to run.
 * @returns the planned check.
 */
export function planFixer(session: Session, script: string): PlannedCheck {
    const [planned] = planChecks(session, { stage: 'all', only: ['sandbox/fixer'] });
    if (planned === undefined) throw new Error('The sandbox has no planned fixer.');
    return { ...planned, check: { ...planned.check, fix: [process.execPath, '-e', script] } };
}

/**
 * Build fixer settings that run the executable of this test process.
 *
 * @param paths files the fixer covers.
 * @returns the gspot.toml text.
 */
export function buildFixerSettings(paths: string[] = ['source.txt']): string {
    return `configurations = []
[[command_check]]
name = "sandbox/fixer"
command = [${JSON.stringify(process.execPath)}, "-e", "process.exitCode = 0"]
fix = [${JSON.stringify(process.execPath)}, "-e", "process.exitCode = 3"]
paths = ${JSON.stringify(paths)}
stage = "commit"
`;
}

/** The tool search state for tests that inspect installed tools. */
export function buildInspectionContext(root: string, fields: Partial<ToolSearch> = {}): ToolSearch {
    return {
        root,
        timeoutSeconds: SETTING_FACTS['tool_timeout_seconds'].default,
        inspections: new Map(),
        ...fields,
    };
}

/** Compile the path patterns of the naming test data. */
export function buildNamingSettings(): NamingSettings {
    return {
        ...NAMING_TEST_SETTINGS,
        overrides: NAMING_TEST_SETTINGS.overrides.map(({ matches, ...override }) => ({
            ...override,
            matches: buildPathMatcher(matches),
        })),
        limitsFor: (language, category) => {
            let cases: readonly NamingCase[] = NAMING_TEST_LIMITS.other;
            if (category === 'types') cases = NAMING_TEST_LIMITS.types;
            else if (language === 'bash') cases = NAMING_TEST_LIMITS.bash;
            return {
                maxChars: NAMING_TEST_LIMITS.maxChars,
                maxWords: NAMING_TEST_LIMITS.maxWords,
                caseNames: [...cases],
            };
        },
    };
}

/** Read the naming settings that apply in one scope of this settings text. */
export function buildScopeNamingSettings(text: string, scope = ''): NamingSettings {
    const settings = parseSettings(text, undefined);
    const selected = selectForScope(settings, scope, readConfigurations());
    const known = buildKnownSettings(selected, 'recommended');
    const view = buildRootScopeSettings(settings, scope);
    return readNamingSettings(settings, {
        view,
        known,
        selected,
        scope: { path: scope, configurations: view.configurations, origin: scope === '' ? 'root' : SETTINGS_FILE },
    });
}

/** Changes that replace the default sources of a sample but keep .gitignore. */
export function buildSandboxChanges(
    originalFiles: Readonly<Record<string, string>>,
    files: Record<string, string>,
): SampleChanges {
    return {
        check: '',
        files,
        removed: Object.keys(originalFiles).filter((path) => path !== '.gitignore' && !Object.hasOwn(files, path)),
    };
}

/** Read the files of a sandbox with the shipped manifests, no scopes, and no declarations. */
export function readTestRepository(root: string): Promise<Repository> {
    return readRepository(createReadCache(root), {
        generatedPaths: [],
        scopes: [],
        configurations: readConfigurations(),
    });
}

/** Read one shipped check by ID, rejecting unknown names. */
export function getShippedCheck(name: string): Check {
    const declaration = listChecksById(readConfigurations().values()).get(name);
    if (declaration === undefined) throw new Error(`The shipped check ${name} does not exist.`);
    return declaration.check;
}

/** Build the settings and check declaration for one naming test. */
export function buildFileNaming(settings: NamingSettings): FileNaming {
    return { check: getShippedCheck('naming/identifiers'), settings, isTestFile: false };
}

/** An identifier with the source location and category defaults used by naming tests. */
export function buildIdentifier(fields: Pick<Identifier, 'name'> & Partial<Identifier>): Identifier {
    const { file = 'src/a.ts', language = 'typescript', category = 'functions', line = 1, column = 1 } = fields;
    return { file, language, category, line, column, label: `${language} ${category}`, ...fields };
}

/** A library pin installed from the npm package with the same name. */
export function buildLibraryPin(name: string, version: string): Tool {
    return { name, kind: 'library', version, installers: { npm: { name, version } } };
}
