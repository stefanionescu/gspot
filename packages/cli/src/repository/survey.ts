// What a repository already runs, read without the configurations: hooks, CI files, agent files, rules and lint folders, the runner.
import { parse as parseYaml } from 'yaml';
import { readText } from '#cli/platform/source.ts';
import { join, dirname, basename } from 'node:path';
import { openRoot } from '#cli/platform/root/open.ts';
import { LOCKFILES } from '#cli/config/parsers/lockfiles.ts';
import { isLintOnlyManifest } from '#cli/repository/scopes.ts';
import { runnerSchema } from '#cli/parsers/schema/settings.ts';
import { readPackageManifest } from '#cli/repository/manifests.ts';
import { HOOKS_DIRECTORY } from '#cli/config/platform/locations.ts';
import type { ProjectManifest } from '#cli/types/parsers/packages.ts';
import { hooksDirectory, readGitSetting } from '#cli/platform/git.ts';
import { statSync, lstatSync, existsSync, readdirSync } from 'node:fs';
import type { Tooling, TrackedFile, RunnerSelection } from '#cli/types/repository/inventory.ts';
import { HOOK_DIRECTORIES, MISE_HOOK_DIRECTORY, HOOK_CONFIGURATION_FILES } from '#cli/config/repository/hooks.ts';

import {
    LINT_PAIRS,
    LINT_WORDS,
    MISE_FILES,
    AGENT_FILES,
    TASK_AFTER_RUN,
    FOREIGN_CI_FILES,
    LINT_DIRECTORIES,
    RULES_DIRECTORIES,
} from '#cli/config/repository/inventory.ts';

// Whether a CI command line runs a linter: eslint, a two-word lint command, or a runner's lint task.
function isLintCommand(command: string): boolean {
    const runners = new Set<string>(runnerSchema.options);
    const words = command.split(/[\s;&|]+/u).filter((word) => word !== '');
    return words.some((word, index) => {
        if (word === 'eslint') return true;
        const next = words[index + 1];
        if (next !== undefined && LINT_PAIRS.has(`${word} ${next}`)) return true;
        if (!runners.has(word)) return false;
        const task = next === 'run' ? words[index + TASK_AFTER_RUN] : next;
        return task === 'lint';
    });
}

// The files in a folder under a root, without dot files; none when the folder does not exist.
function getFiles(root: string, rel: string): string[] {
    if (!existsSync(join(root, rel))) return [];
    using files = openRoot(root);
    let target: string;
    try {
        target = files.realPath(rel);
    } catch (error) {
        if (error instanceof Error && error.message.startsWith('Source link leaves the repository:')) return [];
        throw error;
    }
    if (!statSync(target).isDirectory()) return [];
    return readdirSync(target)
        .toSorted((left, right) => left.localeCompare(right))
        .filter((entry) => !entry.startsWith('.') || entry === '.gitkeep');
}

function hookDirectory(root: string, dir: string, hooksPath: string): Tooling['hooks'][number] | undefined {
    if (hooksPath === dir) return undefined;
    const files = getFiles(root, dir);
    if (files.length === 0 && lstatSync(join(root, dir), { throwIfNoEntry: false })?.isSymbolicLink() !== true)
        return undefined;
    return { kind: dir === '.husky' ? 'husky' : 'githooks', path: dir, files };
}

function detectRunner(paths: Set<string>): RunnerSelection {
    const mise = MISE_FILES.find((name) => paths.has(name));
    if (mise !== undefined) return { runner: 'mise', runnerFile: mise };
    const lockfile = LOCKFILES.filter((entry) => 'runner' in entry).find(({ file }) => paths.has(file));
    if (lockfile === undefined)
        return paths.has('package.json') ? { runner: 'npm', runnerFile: 'package.json' } : { runner: 'none' };
    return { runner: lockfile.client, runnerFile: 'package.json' };
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
            .some((word) => LINT_WORDS.has(word)) || commands.some((command) => isLintCommand(command))
    );
}

/**
 * The hooks a clone already runs: another hooks folder, a hook folder a tool keeps, and hook manager settings.
 * @param root the repository root
 * @returns each set of hooks with where it lives
 */
export function getHooks(root: string): Tooling['hooks'] {
    const manifest = readPackageManifest(root, 'package.json');
    const packageHooks = manifest !== undefined && Object.hasOwn(manifest, 'simple-git-hooks');
    const hooksPath = readGitSetting(root, 'core.hooksPath') ?? '';
    const location = hooksPath === '' ? undefined : hooksDirectory(root);
    const present: string[] = HOOK_CONFIGURATION_FILES.filter(
        (name) => lstatSync(join(root, name), { throwIfNoEntry: false }) !== undefined,
    );
    const lefthook = present.find((name) => name !== '.pre-commit-config.yaml');
    return [
        ...(location === undefined
            ? []
            : [
                  {
                      kind: 'hooksPath' as const,
                      path: hooksPath,
                      files: getFiles(dirname(location), basename(location)),
                  },
              ]),
        ...HOOK_DIRECTORIES.filter((dir) => dir !== HOOKS_DIRECTORY && dir !== MISE_HOOK_DIRECTORY)
            .map((dir) => hookDirectory(root, dir, hooksPath))
            .filter((hook) => hook !== undefined),
        ...(lefthook === undefined ? [] : [{ kind: 'lefthook' as const, path: lefthook, files: [] }]),
        ...(present.includes('.pre-commit-config.yaml')
            ? [{ kind: 'pre-commit' as const, path: '.pre-commit-config.yaml', files: [] }]
            : []),
        ...(packageHooks ? [{ kind: 'simple-git-hooks' as const, path: 'package.json', files: [] }] : []),
    ];
}

/**
 * Find the hooks, CI files, agent files, rules and lint folders, and task runner a repository already has.
 * @param root the repository root
 * @param files the tracked files
 * @param projectManifests the parsed project manifests
 * @param npmNames declared npm installer packages
 * @returns everything init lists except the tool configurations, which need the configurations
 */
export function surveyRepository(
    root: string,
    files: TrackedFile[],
    projectManifests: ProjectManifest[],
    npmNames: ReadonlySet<string>,
): Omit<Tooling, 'configs'> {
    const paths = new Set(files.map((file) => file.path));
    const lintOnlyManifests = projectManifests
        .filter((fact) => fact.kind === 'package.json' && isLintOnlyManifest(fact, npmNames))
        .map((fact) => fact.path)
        .toSorted((a, b) => Number(a === 'package.json') - Number(b === 'package.json'));
    return {
        hooks: getHooks(root),
        ci: [...paths]
            .filter(
                (path) =>
                    FOREIGN_CI_FILES.has(path) ||
                    path === '.gitlab-ci.yml' ||
                    ((path.startsWith('.github/workflows/') || path.startsWith('.gitlab/ci/')) &&
                        (path.endsWith('.yml') || path.endsWith('.yaml'))),
            )
            .toSorted((a, b) => a.localeCompare(b)),
        agentFiles: AGENT_FILES.filter((name) => paths.has(name)),
        rulesDirectories: RULES_DIRECTORIES.filter(
            (name) =>
                lstatSync(join(root, name), { throwIfNoEntry: false })?.isSymbolicLink() === true ||
                getFiles(root, name).some((entry) => entry.endsWith('.md')),
        ),
        lintFolders: LINT_DIRECTORIES.filter((name) => getFiles(root, name).length > 0),
        lintOnlyManifests,
        ...detectRunner(paths),
    };
}

/**
 * Identify authored lint jobs before proposing another CI job.
 * @param root the repository root
 * @param paths the CI files to read
 * @returns the names of the jobs that already run a linter
 */
export function getLintJobs(root: string, paths: string[]): string[] {
    return paths
        .filter((path) => !FOREIGN_CI_FILES.has(path))
        .flatMap((path) => {
            const source = readText(root, path);
            if (source === undefined) return [];
            const document: unknown = parseYaml(source);
            if (typeof document !== 'object' || document === null) return [];
            const jobs = path.startsWith('.github/workflows/') && 'jobs' in document ? document.jobs : document;
            if (typeof jobs !== 'object' || jobs === null) return [];
            return Object.entries(jobs as Record<string, unknown>).flatMap(([name, job]) => {
                if (name.startsWith('.')) return [];
                return isLintJob(name, job) ? [`${path}: ${name}`] : [];
            });
        });
}
