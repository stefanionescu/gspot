import picomatch from 'picomatch';
import { parse as parseYaml } from 'yaml';
import type { Policy } from '#cli/policy/normalize.ts';
import { pathMatcher } from '#cli/repository/paths.ts';
import { hookLocation } from '#cli/lifecycle/hooks/git.ts';
import { isLintOnlyManifest } from '#cli/repository/scopes.ts';
import { readGitSetting } from '#cli/repository/git-config.ts';
// What init lists: configuration at conventional paths, hooks, CI, agent files, home-grown lint folders, the runner.
import type { ToolPin } from '#cli/configurations/manifests.ts';
import type { ManifestFacts } from '#cli/repository/manifests.ts';
import type { TrackedFile } from '#cli/repository/file-classification.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { configurationSection } from '#cli/repository/configuration-section.ts';
import { type ConfinedRoot, openConfinedRoot } from '#cli/platform/filesystem.ts';

import {
    AGENT_FILE_NAMES,
    HOOK_DIRECTORIES,
    LINT_FOLDER_NAMES,
    RULES_DIRECTORY_NAMES,
} from '#cli/repository/patterns.ts';

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
    { file: 'uv.lock', runner: 'none' },
    { file: 'pyproject.toml', runner: 'none' },
];

function listDir(root: string, rel: string): string[] {
    const files = openConfinedRoot(root);
    try {
        if (files.stat(rel)?.isDirectory() !== true) return [];
        return files.list(rel).filter((entry) => !entry.startsWith('.') || entry === '.gitkeep');
    } finally {
        files.close();
    }
}

function hookDirectory(root: string, dir: string, hooksPath: string): ExistingTooling['hooks'][number] | undefined {
    if (hooksPath === dir) return undefined;
    const files = listDir(root, dir);
    if (files.length === 0) return undefined;
    return { kind: dir === '.husky' ? 'husky' : 'githooks', path: dir, files };
}

function hooksFound(root: string, paths: Set<string>): ExistingTooling['hooks'] {
    const hooksPath = readGitSetting(root, 'core.hooksPath') ?? '';
    const location = hooksPath === '' ? undefined : hookLocation(root);
    const lefthook = ['lefthook.yml', '.lefthook.yml'].find((name) => paths.has(name));
    const files = openConfinedRoot(root);
    const manifest = files.read('package.json');
    files.close();
    const simple =
        manifest !== undefined && Object.hasOwn(JSON.parse(manifest.bytes.toString('utf8')), 'simple-git-hooks');
    return [
        ...(location === undefined
            ? []
            : [{ kind: 'hooksPath' as const, path: hooksPath, files: listDir(location.root, location.directory) }]),
        ...HOOK_DIRECTORIES.map((dir) => hookDirectory(root, dir, hooksPath)).filter((hook) => hook !== undefined),
        ...(lefthook === undefined ? [] : [{ kind: 'lefthook' as const, path: lefthook, files: [] }]),
        ...(paths.has('.pre-commit-config.yaml')
            ? [{ kind: 'pre-commit' as const, path: '.pre-commit-config.yaml', files: [] }]
            : []),
        ...(simple ? [{ kind: 'simple-git-hooks' as const, path: 'package.json', files: [] }] : []),
    ];
}

function runnerFound(paths: Set<string>): { runner: ExistingTooling['runner']; runnerFile?: string } {
    const mise = MISE_FILES.find((name) => paths.has(name));
    if (mise !== undefined) return { runner: 'mise', runnerFile: mise };
    const lock = RUNNER_LOCKS.find(({ file }) => paths.has(file));
    if (lock === undefined) return { runner: 'none' };
    return { runner: lock.runner, runnerFile: lock.runner === 'none' ? 'pyproject.toml' : 'package.json' };
}

// The tool configurations one takeover row finds among the tracked files.
function takeoverTools(
    files: ConfinedRoot,
    inventory: Set<string>,
    tool: string,
    takeover: NonNullable<ToolPin['takeover']>[number],
): ExistingTool[] {
    const matches = pathMatcher([takeover.file, `**/${takeover.file}`]);
    const candidates = new Set(inventory);
    if (
        !picomatch.scan(takeover.file).isGlob &&
        !candidates.has(takeover.file) &&
        files.stat(takeover.file) !== undefined
    )
        candidates.add(takeover.file);
    return [...candidates]
        .filter((candidate) => matches(candidate))
        .flatMap((path): ExistingTool[] => {
            if (takeover.table !== undefined || takeover.key !== undefined) {
                const source = files.read(path);
                if (
                    source === undefined ||
                    configurationSection(source.bytes.toString('utf8'), path, {
                        ...(takeover.table === undefined ? {} : { table: takeover.table }),
                        ...(takeover.key === undefined ? {} : { key: takeover.key }),
                    }) === undefined
                )
                    return [];
            }
            return [
                {
                    tool,
                    path,
                    shared: takeover.shared,
                    carries: takeover.carries,
                    ...(takeover.check === undefined ? {} : { check: takeover.check }),
                    ...(takeover.table === undefined ? {} : { table: takeover.table }),
                    ...(takeover.key === undefined ? {} : { key: takeover.key }),
                },
            ];
        });
}

/**
 * Discover configuration sections declared by the tools that own them.
 * @param root the repository root
 * @param paths the tracked file paths
 * @param selected the selected configurations, when only their tools count
 * @returns the tool configurations found, with the file and section each lives in
 */
export function declaredConfigurations(root: string, paths: Iterable<string>, selected?: string[]): ExistingTool[] {
    const inventory = new Set(
        [...paths].filter((path) => !path.split('/').some((part) => part.toLowerCase() === '.gspot')),
    );
    const files = openConfinedRoot(root);
    try {
        return [...configurationManifests().values()].flatMap((manifest) =>
            manifest.tools
                .filter((tool) => selected === undefined || selected.includes(tool.name))
                .flatMap((tool) =>
                    (tool.takeover ?? []).flatMap((takeover) => takeoverTools(files, inventory, tool.name, takeover)),
                ),
        );
    } finally {
        files.close();
    }
}

/**
 * Find declared tool configuration, hooks, CI, and repository-owned lint infrastructure.
 * @param root the repository root
 * @param files the tracked files
 * @param facts the manifests read from the tree
 * @returns the configuration files, hooks, CI, agent files, lint folders and runner found
 */
export function existingTooling(root: string, files: TrackedFile[], facts: ManifestFacts[]): ExistingTooling {
    const paths = new Set(files.map((file) => file.path));
    const lintOnlyManifests = facts
        .filter((fact) => fact.kind === 'package.json' && isLintOnlyManifest(fact))
        .map((fact) => fact.path)
        .toSorted((a, b) => Number(a === 'package.json') - Number(b === 'package.json'));
    const configurations = declaredConfigurations(
        root,
        files.filter((file) => file.nature === 'source').map((file) => file.path),
    );
    return {
        configs: [
            ...new Map(
                configurations.map((entry) => [
                    JSON.stringify([entry.tool, entry.path, entry.table, entry.key]),
                    entry,
                ]),
            ).values(),
        ],
        hooks: hooksFound(root, paths),
        ci: [...paths]
            .filter(
                (path) =>
                    OTHER_CI_FILES.has(path) ||
                    path === '.gitlab-ci.yml' ||
                    ((path.startsWith('.github/workflows/') || path.startsWith('.gitlab/ci/')) &&
                        (path.endsWith('.yml') || path.endsWith('.yaml'))),
            )
            .toSorted((a, b) => a.localeCompare(b)),
        agentFiles: AGENT_FILE_NAMES.filter((name) => paths.has(name)),
        rulesDirectories: RULES_DIRECTORY_NAMES.filter((name) =>
            listDir(root, name).some((entry) => entry.endsWith('.md')),
        ),
        lintFolders: LINT_FOLDER_NAMES.filter((name) => listDir(root, name).length > 0),
        lintOnlyManifests,
        ...runnerFound(paths),
    };
}

/**
 * Identify authored lint jobs before proposing another CI job.
 * @param root the repository root
 * @param paths the CI files to read
 * @returns the names of the jobs that already run a linter
 */
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
                return Object.entries(jobs as Record<string, unknown>).flatMap(([name, job]) => {
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

export type ExistingTool = {
    tool: string;
    path: string;
    shared?: boolean;
    table?: string;
    key?: string;
    carries: NonNullable<ToolPin['takeover']>[number]['carries'];
    check?: string;
};

export type ExistingTooling = {
    configs: ExistingTool[];
    hooks: {
        kind: 'githooks' | 'husky' | 'lefthook' | 'simple-git-hooks' | 'pre-commit' | 'hooksPath';
        path: string;
        files: string[];
    }[];
    ci: string[];
    agentFiles: string[];
    rulesDirectories: string[];
    lintFolders: string[];
    lintOnlyManifests: string[];
    runner: NonNullable<Policy['runner']>['tool'] | 'yarn' | 'none';
    runnerFile?: string;
};
