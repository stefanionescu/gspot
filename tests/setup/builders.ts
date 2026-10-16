import { parse } from '@decimalturn/toml-patch';
import { planRun } from '#cli/planning/checks.ts';
import { parseSettings } from '#cli/settings/read.ts';
import { stripUndefined } from '#cli/system/values.ts';
import { readRepository } from '#cli/repository/read.ts';
import type { ToolSearch } from '#cli/types/tools/find.ts';
import { buildKnownSettings } from '#cli/settings/known.ts';
import { selectForScope } from '#cli/repository/coverage.ts';
import { buildScopeView } from '#cli/settings/scope-view.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import type { SampleChanges } from '#tests/types/samples.ts';
import { buildPathMatcher } from '#cli/repository/matchers.ts';
import type { NamingCase } from '#cli/types/settings/tables.ts';
import { readManifests } from '#cli/configurations/manifests.ts';
import type { RunOptions } from '#cli/types/checks/run/check.ts';
import type { SpawnResult } from '#cli/types/system/processes.ts';
import type { NamingSettings } from '#cli/types/checks/general.ts';
import { SETTING_DEFAULTS } from '#cli/config/settings/defaults.ts';
import type { Session, PlannedCheck } from '#cli/types/planning.ts';
import testsPackage from '#tests/package.json' with { type: 'json' };
import { manifestSchema } from '#cli/configurations/schema/manifest.ts';
import { readNamingSettings } from '#cli/checks/general/naming/settings.ts';
import type { Repository, TrackedFile } from '#cli/types/repository/inventory.ts';
import { MOBILE_SOURCE_FILES } from '#tests/data/generated-files/eslint/framework.ts';
import type { ToolDeclaration, ManifestDeclaration } from '#cli/types/configurations.ts';
import { EXPO_DEPENDENCIES, REACT_NATIVE_DEPENDENCIES } from '#tests/data/checks/react.ts';
import { NAMING_TEST_LIMITS, NAMING_TEST_SETTINGS } from '#tests/data/checks/naming/settings.ts';

/** Select the configurations used by an unattended test initialization. */
export function buildInitArguments(configurations: readonly string[], options: { json?: boolean } = {}): string[] {
    return [
        'init',
        '--yes',
        ...(configurations.length === 0 ? [] : ['--configurations', ...configurations]),
        ...(options.json === true ? ['--json'] : []),
    ];
}

/** Construct the external process result used by check tests. */
export function buildProcessResult(overrides: Partial<SpawnResult> = {}): SpawnResult {
    return { code: 0, stdout: '', stderr: '', missing: false, duration: 1, ...overrides };
}

/**
 * A program pin with an optional npm package installation.
 * @param name the executable name.
 * @param version the pinned version.
 * @param npm the npm package that ships it.
 * @returns the pin.
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
 * Parse an isolated configuration with the declarations its test needs.
 * @param name the configuration name.
 * @param project the extra declarations, required configurations, and configuration group.
 * @returns the parsed manifest.
 */

export function buildManifest(
    name: string,
    project: { requires?: string[]; tables?: string; group?: ManifestDeclaration['configuration']['group'] } = {},
): ManifestDeclaration {
    const declared = manifestSchema.parse({
        ...parse(project.tables ?? ''),
        configuration: {
            name,
            title: name,
            group: project.group ?? 'language',
            requires: project.requires ?? [],
            description: 'A configuration for the tests, long enough.',
        },
    });
    return {
        ...declared,
        checks: declared.checks.map((check) => stripUndefined({ ...check, name: `${name}/${check.name}` })),
        folder: `configurations/${project.group ?? 'language'}/${name}`,
    };
}

/**
 * The options of an in-process run: every stage, the built-in checks, nothing skipped, no fixes, and a real run.
 * @param overrides the options a test changes, such as the checks it runs with only.
 * @returns the run options.
 */

export function buildRunOptions(overrides: Partial<RunOptions>): RunOptions {
    return { stage: 'all', fix: false, isDryRun: false, ...overrides };
}
// Builds repository file entries for test source samples.

/**
 * One tracked source file of one byte with no captured prefix.
 * @param path the root-relative path.
 * @param tags the tags its extension gives it.
 * @returns the tracked file.
 */

export function buildTrackedFile(path: string, tags: string[] = ['text']): TrackedFile {
    return { path, kind: 'source', tags, executable: false, size: 1 };
}
// Builds the settings and plan for a test fixer.

/**
 * The planned fixer of the sandbox with its command replaced by a script.
 * @param session the open sandbox session.
 * @param script the JavaScript the fixer runs.
 * @returns the planned check.
 */
export function planFixer(session: Session, script: string): PlannedCheck {
    const [planned] = planRun(session, { stage: 'all', only: ['sandbox/fixer'] });
    if (planned === undefined) throw new Error('The sandbox has no planned fixer.');
    return { ...planned, check: { ...planned.check, fix: [process.execPath, '-e', script] } };
}

/**
 * Build the shared fixer settings with the executable of the current test process.
 * @param paths the source paths owned by the fixer.
 * @returns the settings for an isolated fixer plan.
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
/** Build the read state for installed tool inspection. */
export function inspectionContext(root: string, fields: Partial<ToolSearch> = {}): ToolSearch {
    return { root, timeoutSeconds: SETTING_DEFAULTS.tool_timeout_seconds, inspections: new Map(), ...fields };
}

/** Compile the path patterns of the naming test data. */
export function buildNamingSettings(): NamingSettings {
    return {
        ...NAMING_TEST_SETTINGS,
        rules: NAMING_TEST_SETTINGS.rules.map(({ matches, ...rule }) => ({
            ...rule,
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

/** Read effective naming settings from one authored settings text and scope. */
export function namingSettingsFor(text: string, scope = ''): NamingSettings {
    const reads = createReadCache(process.cwd());
    const settings = parseSettings(text, undefined, reads);
    const selected = selectForScope(settings, scope, readManifests(reads));
    const view = buildScopeView(buildKnownSettings(selected), settings, selected, scope);
    return readNamingSettings({
        scope: { view, scope: { path: scope }, selected },
        settingsFile: { settings },
        reads,
    });
}

/** Replace a sample's default sources while retaining the sandbox's ignore file. */
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

/** Read a sandbox inventory with the shipped manifests and no authored scope or generated declarations. */
export function readTestRepository(root: string): Promise<Repository> {
    return readRepository(createReadCache(root), {
        declarations: [],
        scopes: [],
        manifests: readManifests(createReadCache(process.cwd())),
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
