import { find } from '#cli/system/files/reads.ts';
import { compareText } from '#cli/system/text.ts';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import type { ReadCache } from '#cli/types/system/files.ts';
import { type Repository } from '#cli/types/repository/files.ts';
import { parseYamlDocuments } from '#cli/parsers/formats/yaml.ts';
import { isInside, convertToPosixPath } from '#cli/system/paths.ts';
import { readGitSetting, readHooksFolder } from '#cli/system/git.ts';
import { ESLINT_MANIFEST_TOOL } from '#cli/config/manifests/names.ts';
import { join, dirname, resolve, basename, relative } from 'node:path';
import { EXECUTABLE_BITS } from '#cli/config/repository/files/tracked.ts';
import { PACKAGE_JSON } from '#cli/config/parsers/projects/dependencies.ts';
import { listConflictingConfigFiles } from '#cli/repository/config-files.ts';
import { MARKDOWN_EXTENSION } from '#cli/config/repository/files/classify.ts';
import { ciJobSchema, ciDocumentSchema } from '#cli/schemas/repository/setup.ts';
import { statSync, lstatSync, readdirSync, realpathSync, readFileSync } from 'node:fs';
import { readPackageJson, listToolOnlyPackages } from '#cli/repository/dependencies.ts';
import { LFS_HOOKS, HOOK_SHEBANG, LFS_GUARD_PREFIX } from '#cli/config/generation/hooks.ts';
import { type CiJob, type RepositoryHooks, type RepositorySetup } from '#cli/types/repository/setup.ts';

import {
    RUN_WORD,
    LINT_TASK,
    HUSKY_PATH,
    LINT_PAIRS,
    LINT_WORDS,
    AGENT_FILES,
    LINT_FOLDERS,
    RULE_FOLDERS,
    RUNNER_NAMES,
    KEPT_DOT_FILE,
    LFS_PUSH_CALLS,
    LEFTHOOK_NAMES,
    GITLAB_CI_FILE,
    TASK_AFTER_RUN,
    YAML_EXTENSIONS,
    PRE_COMMIT_FILE,
    FOREIGN_CI_FILES,
    GITLAB_CI_FOLDER,
    LEFTHOOK_PREFIXES,
    SAMPLE_HOOK_SUFFIX,
    HOOKS_PATH_SETTING,
    COMMAND_SEPARATORS,
    LEFTHOOK_EXTENSIONS,
    JOB_NAME_SEPARATORS,
    FOREIGN_HOOK_FOLDERS,
    SIMPLE_GIT_HOOKS_KEY,
    GITHUB_WORKFLOWS_FOLDER,
} from '#cli/config/repository/setup.ts';

function isLintCommand(command: string): boolean {
    const words = command.split(COMMAND_SEPARATORS).filter((word) => word !== '');
    return words.some((word, index) => {
        if (word === ESLINT_MANIFEST_TOOL) return true;
        const next = words[index + 1];
        if (next !== undefined && LINT_PAIRS.has(`${word} ${next}`)) return true;
        if (!RUNNER_NAMES.includes(word)) return false;
        const task = next === RUN_WORD ? words[index + TASK_AFTER_RUN] : next;
        return task === LINT_TASK;
    });
}

function listFolder(root: string, folder: string): string[] {
    const path = join(root, folder);
    if (statSync(path, { throwIfNoEntry: false }) === undefined) return [];
    const canonicalRoot = realpathSync(root);
    const target = realpathSync(path);
    if (!isInside(relative(canonicalRoot, target)) || !statSync(target).isDirectory()) return [];
    return readdirSync(target)
        .toSorted((left, right) => compareText(left, right))
        .filter((name) => !name.startsWith('.') || name === KEPT_DOT_FILE);
}

function detectHookFolder(
    root: string,
    folder: string,
    hooksPath: string,
): RepositorySetup['hooks'][number] | undefined {
    if (hooksPath === folder) return undefined;
    const files = listFolder(root, folder).filter(
        (name) => statSync(join(root, folder, name), { throwIfNoEntry: false })?.isFile() === true,
    );
    if (files.length === 0) return undefined;
    return { kind: folder === HUSKY_PATH ? 'husky' : 'githooks', path: folder, files };
}

function listJobCommands(job: CiJob): string[] {
    if (job.script !== undefined) return Array.isArray(job.script) ? job.script : [job.script];
    return (job.steps ?? []).flatMap((step) => (step.run === undefined ? [] : [step.run]));
}

function isLintJob(name: string, job: CiJob): boolean {
    if (job.steps === undefined && job.script === undefined && job.extends === undefined) return false;
    return (
        name
            .toLowerCase()
            .split(JOB_NAME_SEPARATORS)
            .some((word) => LINT_WORDS.has(word)) || listJobCommands(job).some((command) => isLintCommand(command))
    );
}

function listLintJobs(path: string, document: unknown): string[] {
    const parsed = ciDocumentSchema.safeParse(document);
    if (!parsed.success) return [];
    const source = path.startsWith(GITHUB_WORKFLOWS_FOLDER) ? ciDocumentSchema.safeParse(parsed.data['jobs']) : parsed;
    if (!source.success) return [];
    return Object.entries(source.data)
        .values()
        .map(([name, value]) => {
            if (name.startsWith('.')) return undefined;
            const job = ciJobSchema.safeParse(value);
            return job.success && isLintJob(name, job.data) ? `${path}: ${name}` : undefined;
        })
        .filter((job) => job !== undefined)
        .toArray();
}

async function readHooksPathSetup(root: string, hooksPath: string): Promise<RepositorySetup['hooks']> {
    if (hooksPath === '') return [];
    const location = await readHooksFolder(root);
    return [
        {
            kind: 'hooksPath',
            path: hooksPath,
            files: listFolder(dirname(location), basename(location)).filter(
                (name) =>
                    statSync(join(dirname(location), basename(location), name), { throwIfNoEntry: false })?.isFile() ===
                    true,
            ),
        },
    ];
}

async function listHookSetups(root: string, hooksPath: string): Promise<RepositorySetup['hooks']> {
    const packageJson = readPackageJson(root, PACKAGE_JSON);
    const isPackageHooks = packageJson !== undefined && Object.hasOwn(packageJson, SIMPLE_GIT_HOOKS_KEY);
    const hookNames = [
        ...LEFTHOOK_NAMES.flatMap((name) =>
            LEFTHOOK_EXTENSIONS.flatMap((extension) =>
                LEFTHOOK_PREFIXES.map((prefix) => `${prefix}${name}.${extension}`),
            ),
        ),
        PRE_COMMIT_FILE,
    ];
    const present = hookNames.filter((name) => lstatSync(join(root, name), { throwIfNoEntry: false }) !== undefined);
    const lefthook = present.find((name) => name !== PRE_COMMIT_FILE);
    return [
        ...(await readHooksPathSetup(root, hooksPath)),
        ...FOREIGN_HOOK_FOLDERS.map((folder) => detectHookFolder(root, folder, hooksPath)).filter(
            (hook) => hook !== undefined,
        ),
        ...(lefthook === undefined ? [] : [{ kind: 'lefthook' as const, path: lefthook, files: [] }]),
        ...(present.includes(PRE_COMMIT_FILE)
            ? [{ kind: 'pre-commit' as const, path: PRE_COMMIT_FILE, files: [] }]
            : []),
        ...(isPackageHooks ? [{ kind: 'simple-git-hooks' as const, path: PACKAGE_JSON, files: [] }] : []),
    ];
}

function isLfsHookScript(folder: string, name: string): boolean {
    if (!(LFS_HOOKS as readonly string[]).includes(name)) return false;
    const lines = readFileSync(join(folder, name), 'utf8').trim().split(/\r?\n/u);
    const call = lines.at(-1) ?? '';
    const isCall = call === `git lfs ${name} "$@"` || (name === 'pre-push' && LFS_PUSH_CALLS.has(call));
    return lines[0] === HOOK_SHEBANG && isCall && lines.slice(1, -1).every((line) => line.startsWith(LFS_GUARD_PREFIX));
}

async function listGitFolderHooks(root: string): Promise<RepositorySetup['hooks']> {
    const folder = await readHooksFolder(root);
    if (statSync(folder, { throwIfNoEntry: false })?.isDirectory() !== true) return [];
    const files = readdirSync(folder).filter((name) => {
        if (name.endsWith(SAMPLE_HOOK_SUFFIX)) return false;
        const stat = statSync(join(folder, name), { throwIfNoEntry: false });
        return (
            stat?.isFile() === true &&
            (process.platform === 'win32' || (stat.mode & EXECUTABLE_BITS) !== 0) &&
            !isLfsHookScript(folder, name)
        );
    });
    return files.length === 0 ? [] : [{ kind: 'hooksPath', path: convertToPosixPath(relative(root, folder)), files }];
}

/**
Read the hooks that a clone already runs: another hooks folder, a tool hooks folder, and hook manager settings.

@param repository the repository to read and whether Git tracks it
*/
export async function readHooks(repository: Pick<Repository, 'root' | 'hasGit'>): Promise<RepositoryHooks> {
    const { root, hasGit } = repository;
    const written = hasGit ? await readGitSetting(root, HOOKS_PATH_SETTING) : undefined;
    const hooksPath = convertToPosixPath(relative(root, resolve(root, written ?? '')));
    const own = hooksPath === GSPOT_PATHS.hooks || hooksPath === HUSKY_PATH || hooksPath.startsWith(`${HUSKY_PATH}/`);
    const hooks = await listHookSetups(root, own ? '' : hooksPath);
    if (written === undefined && hasGit) hooks.push(...(await listGitFolderHooks(root)));
    return { hooksPath, hooks };
}

/**
Find the existing jobs that run a linter.

@param root the repository to read.
@param paths the CI files to read.
*/
export function readLintJobs(root: string, paths: string[]): string[] {
    return paths
        .filter((path) => !FOREIGN_CI_FILES.has(path))
        .flatMap((path) => {
            const source = find(root, path);
            if (source === undefined) return [];
            return parseYamlDocuments(path, source).flatMap((document) => listLintJobs(path, document));
        });
}

/**
Find config files to replace, hooks, CI, agent files, and lint folders.

@param reads the run cache.
@param repository the inventory and parsed package declarations.
@returns what to replace, keep, or report.
*/
export async function readRepositorySetup(
    reads: ReadCache,
    repository: Pick<Repository, 'files' | 'dependencyFiles' | 'hasGit'>,
): Promise<RepositorySetup> {
    const root = reads.root;
    const { files, dependencyFiles } = repository;
    const paths = new Set(files.map((file) => file.path));
    const configurationsByName = readConfigurations();
    const toolOnlyPackages = [...listToolOnlyPackages(dependencyFiles, configurationsByName.values())].toSorted(
        (a, b) => Number(a === PACKAGE_JSON) - Number(b === PACKAGE_JSON),
    );

    const conflictingConfigFiles = listConflictingConfigFiles(root, files, configurationsByName.values());
    const { hooks } = await readHooks({ root, hasGit: repository.hasGit });
    return {
        conflictingConfigFiles: new Map(
            conflictingConfigFiles.map((conflictingConfigFile) => [
                JSON.stringify([
                    conflictingConfigFile.tool,
                    conflictingConfigFile.path,
                    conflictingConfigFile.table,
                    conflictingConfigFile.key,
                ]),
                conflictingConfigFile,
            ]),
        )
            .values()
            .toArray(),
        hooks,
        ci: [...paths]
            .filter(
                (path) =>
                    FOREIGN_CI_FILES.has(path) ||
                    path === GITLAB_CI_FILE ||
                    ((path.startsWith(GITHUB_WORKFLOWS_FOLDER) || path.startsWith(GITLAB_CI_FOLDER)) &&
                        YAML_EXTENSIONS.some((extension) => path.endsWith(extension))),
            )
            .toSorted((a, b) => compareText(a, b)),
        agentFiles: AGENT_FILES.filter((name) => paths.has(name)),
        ruleFolders: RULE_FOLDERS.filter(
            (name) =>
                lstatSync(join(root, name), { throwIfNoEntry: false })?.isSymbolicLink() === true ||
                listFolder(root, name).some((child) => child.endsWith(MARKDOWN_EXTENSION)),
        ),
        lintFolders: LINT_FOLDERS.filter((name) => listFolder(root, name).length > 0),
        toolOnlyPackages,
    };
}
