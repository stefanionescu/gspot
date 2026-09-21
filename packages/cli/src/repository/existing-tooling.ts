import { parse as parseYaml } from 'yaml';
import { openConfinedRoot } from '#cli/lifecycle/confined.ts';
// What init lists: configuration at conventional paths, hooks, CI, agent files, home-grown lint folders, the runner.
import { join } from 'node:path';
import { readGitSetting } from '#cli/platform/spawn.ts';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { isLintOnlyManifest } from '#cli/repository/scopes.ts';
import type { ExistingTool, ExistingTooling, ManifestFacts, ScopeEntry, TrackedFile } from '#types/repository.ts';

import {
    AGENT_FILE_NAMES,
    CONVENTIONAL_CONFIG_PATHS,
    HOOK_DIRECTORIES,
    LINT_FOLDER_NAMES,
    RULES_DIRECTORY_NAMES,
} from '#config/patterns.ts';

const OTHER_CI_FILES = new Set([
    'Jenkinsfile',
    'bitbucket-pipelines.yml',
    '.circleci/config.yml',
    'azure-pipelines.yml',
    '.buildkite/pipeline.yml',
]);

const MISE_FILES = ['mise.toml', '.mise.toml', '.mise/config.toml', '.tool-versions', 'mise.local.toml'];
const RUNNER_LOCKS: { file: string; runner: ExistingTooling['runner'] }[] = [
    { file: 'bun.lock', runner: 'bun' },
    { file: 'bun.lockb', runner: 'bun' },
    { file: 'pnpm-lock.yaml', runner: 'pnpm' },
    { file: 'yarn.lock', runner: 'yarn' },
    { file: 'package-lock.json', runner: 'npm' },
    { file: 'package.json', runner: 'npm' },
    { file: 'uv.lock', runner: 'uv' },
    { file: 'pyproject.toml', runner: 'uv' },
];

function listDir(root: string, rel: string): string[] {
    const full = join(root, rel);
    if (!existsSync(full) || !statSync(full).isDirectory()) return [];
    return readdirSync(full)
        .filter((entry) => !entry.startsWith('.') || entry === '.gitkeep')
        .toSorted((a, b) => a.localeCompare(b));
}

function hasFiles(root: string, rel: string): boolean {
    return listDir(root, rel).length > 0;
}

function isBareDirectoryName(name: string): boolean {
    return name.startsWith('.') && !name.includes('.', 1);
}

function isConfigurationPresent(root: string, paths: Set<string>, name: string, path: string): boolean {
    return paths.has(path) || (isBareDirectoryName(name) && hasFiles(root, path));
}

function conventionalConfigs(root: string, paths: Set<string>, scopes: ScopeEntry[]): ExistingTool[] {
    const prefixes = ['', ...scopes.filter((scope) => scope.path !== '').map((scope) => `${scope.path}/`)];
    return Object.entries(CONVENTIONAL_CONFIG_PATHS).flatMap(([tool, names]) => {
        if (['prettier', 'prettierignore', 'editorconfig', 'eslint'].includes(tool))
            return [...paths]
                .filter((path) => names.some((name) => path === name || path.endsWith(`/${name}`)))
                .map((path): ExistingTool => ({ tool, path }));
        return prefixes.flatMap((prefix) =>
            names
                .filter((name) => isConfigurationPresent(root, paths, name, `${prefix}${name}`))
                .map((name): ExistingTool => ({ tool, path: `${prefix}${name}` })),
        );
    });
}

function hookDirectory(root: string, dir: string, hooksPath: string): ExistingTooling['hooks'][number] | undefined {
    if (hooksPath === dir || !hasFiles(root, dir)) return undefined;
    if (dir === '.husky') return { kind: 'husky', path: dir, files: listDir(root, dir) };
    return { kind: 'githooks', path: dir, files: listDir(root, dir) };
}

function hooksFound(root: string, paths: Set<string>): ExistingTooling['hooks'] {
    const hooksPath = readGitSetting(root, 'core.hooksPath') ?? '';
    const isForeignPath = hooksPath !== '';
    const lefthook = ['lefthook.yml', '.lefthook.yml'].find((name) => paths.has(name));
    return [
        ...(isForeignPath ? [{ kind: 'hooksPath' as const, path: hooksPath, files: listDir(root, hooksPath) }] : []),
        ...HOOK_DIRECTORIES.map((dir) => hookDirectory(root, dir, hooksPath)).filter((hook) => hook !== undefined),
        ...(lefthook === undefined ? [] : [{ kind: 'lefthook' as const, path: lefthook, files: [] }]),
    ];
}

function runnerFound(paths: Set<string>): { runner: ExistingTooling['runner']; runnerFile?: string } {
    const mise = MISE_FILES.find((name) => paths.has(name));
    if (mise !== undefined) return { runner: 'mise', runnerFile: mise };
    const lock = RUNNER_LOCKS.find(({ file }) => paths.has(file));
    if (lock === undefined) return { runner: 'none' };
    return { runner: lock.runner, runnerFile: lock.runner === 'uv' ? 'pyproject.toml' : 'package.json' };
}

function isWorkflow(path: string): boolean {
    return (
        OTHER_CI_FILES.has(path) ||
        path === '.gitlab-ci.yml' ||
        ((path.startsWith('.github/workflows/') || path.startsWith('.gitlab/ci/')) &&
            (path.endsWith('.yml') || path.endsWith('.yaml')))
    );
}

/** Find tool configuration keys while preserving their shared package manifests. */
export function packageConfigurations(root: string, paths: Iterable<string>): ExistingTool[] {
    const files = openConfinedRoot(root);
    const candidates = new Set(['package.json', 'package.yaml', ...paths]);
    try {
        return [...candidates].flatMap((path): ExistingTool[] => {
            if (!['package.json', 'package.yaml'].some((name) => path === name || path.endsWith(`/${name}`))) return [];
            const source = files.read(path);
            if (source === undefined) return [];
            const text = source.bytes.toString('utf8');
            const value: unknown = path.endsWith('.yaml') ? parseYaml(text) : JSON.parse(text);
            if (typeof value !== 'object' || value === null) return [];
            return [
                ...('prettier' in value && Boolean(value.prettier) ? [{ tool: 'prettier', path }] : []),
                ...(path.endsWith('.json') && 'eslintConfig' in value && Boolean(value.eslintConfig)
                    ? [{ tool: 'eslint', path }]
                    : []),
            ];
        });
    } finally {
        files.close();
    }
}

/**
 * Everything init lists about the tools a repository already has. Reads conventional paths only.
 * @param root the repository root
 * @param files the tracked files
 * @param scopes the scopes, root first
 * @param facts the manifests read from the tree
 * @returns the configuration files, hooks, CI, agent files, lint folders and runner found
 */
export function existingTooling(
    root: string,
    files: TrackedFile[],
    scopes: ScopeEntry[],
    facts: ManifestFacts[],
): ExistingTooling {
    const paths = new Set(files.map((file) => file.path));
    const lintOnlyManifests = facts
        .filter((fact) => fact.kind === 'package.json' && isLintOnlyManifest(fact))
        .map((fact) => fact.path)
        .toSorted((a, b) => Number(a === 'package.json') - Number(b === 'package.json'));
    return {
        configs: [...conventionalConfigs(root, paths, scopes), ...packageConfigurations(root, paths)],
        hooks: hooksFound(root, paths),
        ci: [...paths].filter((path) => isWorkflow(path)).toSorted((a, b) => a.localeCompare(b)),
        agentFiles: AGENT_FILE_NAMES.filter((name) => paths.has(name)),
        rulesDirectories: RULES_DIRECTORY_NAMES.filter((name) =>
            listDir(root, name).some((entry) => entry.endsWith('.md')),
        ),
        lintFolders: LINT_FOLDER_NAMES.filter((name) => hasFiles(root, name)),
        lintOnlyManifests,
        ...runnerFound(paths),
    };
}

/** Identify authored lint jobs before proposing another CI job. */
export function ciLintJobs(root: string, paths: string[]): string[] {
    const files = openConfinedRoot(root);
    try {
        return paths
            .filter((path) => !OTHER_CI_FILES.has(path))
            .flatMap((path) => {
                const source = files.read(path);
                if (source === undefined) return [];
                const document: unknown = parseYaml(source.bytes.toString('utf8'));
                if (typeof document !== 'object' || document === null) return [];
                const jobs = path.startsWith('.github/workflows/') && 'jobs' in document ? document.jobs : document;
                if (typeof jobs !== 'object' || jobs === null) return [];
                return Object.entries(jobs).flatMap(([name, job]) => {
                    if (name.startsWith('.')) return [];
                    if (typeof job !== 'object' || job === null || Array.isArray(job)) return [];
                    if (!('steps' in job) && !('script' in job) && !('extends' in job)) return [];
                    const commands =
                        'script' in job
                            ? job.script
                            : 'steps' in job && Array.isArray(job.steps)
                              ? job.steps.flatMap((step: unknown) =>
                                    typeof step === 'object' && step !== null && 'run' in step ? [step.run] : [],
                                )
                              : [];
                    const texts = (Array.isArray(commands) ? commands : [commands]).filter(
                        (command): command is string => typeof command === 'string',
                    );
                    const lint =
                        /(?:^|[-_: ])(?:lint|quality|gspot)(?:$|[-_: ])/iu.test(name) ||
                        texts.some((command) =>
                            /(?:^|[\s;&|])(?:gspot\s+check|eslint|biome\s+check|ruff\s+check|(?:npm|pnpm|yarn|bun|mise)\s+(?:run\s+)?(?:lint|gspot:check))(?:$|[\s;&|])/u.test(
                                command,
                            ),
                        );
                    return lint ? [`${path}: ${name}`] : [];
                });
            });
    } finally {
        files.close();
    }
}
