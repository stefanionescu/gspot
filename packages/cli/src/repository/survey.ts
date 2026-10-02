// What a repository already runs, read without the kits: hooks, CI files, agent files, rules and lint folders, the runner.
import { existsSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';
import { join, dirname, basename } from 'node:path';
import { openRoot } from '#cli/platform/filesystem.ts';
import { isLintOnlyManifest } from '#cli/repository/scopes.ts';
import { hooksDirectory, readGitSetting } from '#cli/platform/git.ts';
import type { Fields, TrackedFile, ExistingTooling } from '#cli/types/repository/repository.ts';
import { AGENT_FILE_NAMES, LINT_FOLDER_NAMES, RULES_DIRECTORY_NAMES } from '#cli/config/repository/patterns.ts';

import {
    LINT_PAIRS,
    LINT_WORDS,
    MISE_FILES,
    RUNNER_LOCKS,
    TASK_RUNNERS,
    OTHER_CI_FILES,
    FOREIGN_HOOK_DIRECTORIES as HOOK_DIRECTORIES,
} from '#cli/config/repository/repository.ts';

// In "<runner> run <task>", the task sits two words after the runner.
const TASK_AFTER_RUN = 2;

// Whether a CI command line runs a linter: eslint, a two-word lint command, or a runner's lint task.
function runsLint(command: string): boolean {
    const words = command.split(/[\s;&|]+/u).filter((word) => word !== '');
    return words.some((word, index) => {
        if (word === 'eslint') return true;
        const next = words[index + 1];
        if (next !== undefined && LINT_PAIRS.has(`${word} ${next}`)) return true;
        if (!TASK_RUNNERS.has(word)) return false;
        const task = next === 'run' ? words[index + TASK_AFTER_RUN] : next;
        return task === 'lint';
    });
}

// The files in a folder under a root, without dot files; none when the folder does not exist.
function listDir(root: string, rel: string): string[] {
    if (!existsSync(join(root, rel))) return [];
    const files = openRoot(root);
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

function runnerFound(paths: Set<string>): { runner: ExistingTooling['runner']; runnerFile?: string } {
    const mise = MISE_FILES.find((name) => paths.has(name));
    if (mise !== undefined) return { runner: 'mise', runnerFile: mise };
    const lock = RUNNER_LOCKS.find(({ file }) => paths.has(file));
    if (lock === undefined) return { runner: 'none' };
    return { runner: lock.runner, runnerFile: lock.runner === 'none' ? 'pyproject.toml' : 'package.json' };
}

function hasPackageHooks(root: string): boolean {
    const files = openRoot(root);
    try {
        const source = files.read('package.json');
        if (source === undefined) return false;
        const manifest: unknown = JSON.parse(source.bytes.toString('utf8'));
        return typeof manifest === 'object' && manifest !== null && Object.hasOwn(manifest, 'simple-git-hooks');
    } finally {
        files.close();
    }
}

function jobCommands(job: object): string[] {
    let commands: unknown = [];
    if ('script' in job) commands = job.script;
    else if ('steps' in job && Array.isArray(job.steps)) {
        commands = job.steps.flatMap((step: unknown) =>
            typeof step === 'object' && step !== null && 'run' in step ? [step.run] : [],
        );
    }
    return (Array.isArray(commands) ? commands : [commands]).filter(
        (command): command is string => typeof command === 'string',
    );
}

function isLintJob(name: string, job: unknown): boolean {
    if (typeof job !== 'object' || job === null || Array.isArray(job)) return false;
    if (!('steps' in job) && !('script' in job) && !('extends' in job)) return false;
    const commands = jobCommands(job);
    return (
        name
            .toLowerCase()
            .split(/[-_: ]/u)
            .some((word) => LINT_WORDS.has(word)) || commands.some((command) => runsLint(command))
    );
}

/**
 * The hooks a clone already runs: another hooks folder, a hook folder a tool keeps, and hook manager settings.
 * @param root the repository root
 * @returns each set of hooks with where it lives
 */
export function existingHooks(root: string): ExistingTooling['hooks'] {
    const hooksPath = readGitSetting(root, 'core.hooksPath') ?? '';
    const location = hooksPath === '' ? undefined : hooksDirectory(root);
    const files = openRoot(root);
    let present: string[];
    try {
        present = ['lefthook.yml', '.lefthook.yml', '.pre-commit-config.yaml'].filter(
            (name) => files.stat(name) !== undefined,
        );
    } finally {
        files.close();
    }
    const lefthook = present.find((name) => name !== '.pre-commit-config.yaml');
    return [
        ...(location === undefined
            ? []
            : [{ kind: 'hooksPath' as const, path: hooksPath, files: listDir(dirname(location), basename(location)) }]),
        ...HOOK_DIRECTORIES.map((dir) => hookDirectory(root, dir, hooksPath)).filter((hook) => hook !== undefined),
        ...(lefthook === undefined ? [] : [{ kind: 'lefthook' as const, path: lefthook, files: [] }]),
        ...(present.includes('.pre-commit-config.yaml')
            ? [{ kind: 'pre-commit' as const, path: '.pre-commit-config.yaml', files: [] }]
            : []),
        ...(hasPackageHooks(root) ? [{ kind: 'simple-git-hooks' as const, path: 'package.json', files: [] }] : []),
    ];
}

/**
 * Find the hooks, CI files, agent files, rules and lint folders, and task runner a repository already has.
 * @param root the repository root
 * @param files the tracked files
 * @param fields the manifests read from the tree
 * @returns everything init lists except the tool configurations, which need the kits
 */
export function surveyRepository(
    root: string,
    files: TrackedFile[],
    fields: Fields[],
): Omit<ExistingTooling, 'configs'> {
    const paths = new Set(files.map((file) => file.path));
    const lintOnlyManifests = fields
        .filter((fact) => fact.kind === 'package.json' && isLintOnlyManifest(fact))
        .map((fact) => fact.path)
        .toSorted((a, b) => Number(a === 'package.json') - Number(b === 'package.json'));
    return {
        hooks: existingHooks(root),
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
    const files = openRoot(root);
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
                    return isLintJob(name, job) ? [`${path}: ${name}`] : [];
                });
            });
    } finally {
        files.close();
    }
}
