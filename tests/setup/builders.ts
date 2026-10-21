import { parse } from '@decimalturn/toml-patch';
import { planRun } from '#cli/planning/checks.ts';
import { parseSettings } from '#cli/settings/read.ts';
import { readRepository } from '#cli/repository/read.ts';
import type { RunOptions } from '#cli/types/runs/check.ts';
import type { ToolSearch } from '#cli/types/tools/find.ts';
import { buildKnownSettings } from '#cli/settings/known.ts';
import { selectForScope } from '#cli/repository/coverage.ts';
import { buildScopeView } from '#cli/settings/scope-view.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import type { SampleChanges } from '#tests/types/samples.ts';
import { buildPathMatcher } from '#cli/repository/matchers.ts';
import { SETTINGS_FILE } from '#cli/config/system/locations.ts';
import type { NamingCase } from '#cli/types/settings/tables.ts';
import { SOURCE_KIND } from '#cli/config/repository/inventory.ts';
import type { NamingSettings } from '#cli/types/checks/naming.ts';
import type { SpawnResult } from '#cli/types/system/processes.ts';
import { readNamingSettings } from '#cli/checks/naming/settings.ts';
import type { Session, PlannedCheck } from '#cli/types/planning.ts';
import testsPackage from '#tests/package.json' with { type: 'json' };
import { manifestSchema } from '#cli/schemas/configurations/manifest.ts';
import { selectCheckImplementation } from '#cli/checks/implementations.ts';
import { SETTING_DECLARATIONS } from '#cli/config/settings/declarations.ts';
import { readManifests, listChecksById } from '#cli/configurations/manifests.ts';
import { MOBILE_SOURCE_FILES } from '#tests/data/generation/eslint/framework.ts';
import type { Repository, TrackedFile } from '#cli/types/repository/inventory.ts';
import { EXPO_DEPENDENCIES, REACT_NATIVE_DEPENDENCIES } from '#tests/data/checks/react.ts';
import { NAMING_TEST_LIMITS, NAMING_TEST_SETTINGS } from '#tests/data/checks/naming/settings.ts';
import { type ToolDeclaration, type CheckDeclaration, type ManifestDeclaration } from '#cli/types/configurations.ts';

/**
 * List the shipped configurations that gspot selects in every repository.
 *
 * @returns their names.
 */
export function listAlwaysSelected(): string[] {
    return [...readManifests().values()]
        .filter(({ configuration }) => configuration.always_selected)
        .map(({ configuration }) => configuration.name);
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
    return { code: 0, stdout: '', stderr: '', missing: false, duration: 1, ...overrides };
}

/**
 * A program pin, with an npm installer when npm names a package.
 *
 * @param name executable to pin.
 * @param version release to pin.
 * @param npm package that ships the program.
 * @returns a tool record with that program pinned.
 */
export function buildProgramPin(name: string, version: string, npm?: string): ToolDeclaration {
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
 * @param project extra manifest tables and fields.
 * @param project.requires configurations that it needs.
 * @param project.tables extra TOML for the manifest.
 * @param project.group where the configuration sits.
 * @returns the parsed manifest.
 */
export function buildManifest(
    name: string,
    project: { requires?: string[]; tables?: string; group?: ManifestDeclaration['configuration']['group'] } = {},
): ManifestDeclaration {
    return manifestSchema.parse({
        ...parse(project.tables ?? ''),
        folder: `configurations/${project.group ?? 'language'}/${name}`,
        configuration: {
            name,
            title: name,
            group: project.group ?? 'language',
            requires: project.requires ?? [],
            description: 'A configuration for the tests, long enough.',
        },
    });
}

/**
 * Options for an in-process run of every stage, with no fixes.
 *
 * @param overrides what the test changes.
 * @returns the defaults with the overrides applied.
 */
export function buildRunOptions(overrides: Partial<RunOptions>): RunOptions {
    return { stage: 'all', fix: false, isDryRun: false, selectImplementation: selectCheckImplementation, ...overrides };
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
    const [planned] = planRun(session, { stage: 'all', only: ['sandbox/fixer'] });
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
        timeoutSeconds: SETTING_DECLARATIONS['tool_timeout_seconds'].default,
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
    const selected = selectForScope(settings, scope, readManifests());
    const known = buildKnownSettings(selected, 'recommended');
    const view = buildScopeView(known, settings, selected, scope);
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
        declarations: [],
        scopes: [],
        manifests: readManifests(),
    });
}

/** Build sibling Expo and bare React Native packages with the installed test React version. */
export function buildMobileFiles(): Record<string, string> {
    return {
        ...MOBILE_SOURCE_FILES,
        'bare/package.json': JSON.stringify({
            private: true,
            dependencies: { react: testsPackage.devDependencies.react, ...REACT_NATIVE_DEPENDENCIES },
        }),
        'expo-app/package.json': JSON.stringify({
            private: true,
            dependencies: { react: testsPackage.devDependencies.react, ...EXPO_DEPENDENCIES },
        }),
    };
}

/** Read one shipped check by ID, rejecting unknown names. */
export function getShippedCheck(name: string): CheckDeclaration {
    const declaration = listChecksById(readManifests().values()).get(name);
    if (declaration === undefined) throw new Error(`The shipped check ${name} does not exist.`);
    return declaration.check;
}
