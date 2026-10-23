// Find existing lint commands, hooks, and config files.
import { findText } from '#cli/system/files/reads.ts';
import type { ManagedKeys } from '#cli/types/apply.ts';
import type { ReadCache } from '#cli/types/system/files.ts';
import { parseYamlFile } from '#cli/parsers/formats/yaml.ts';
import { type Repository } from '#cli/types/repository/files.ts';
import { TRAILING_SLASH } from '#cli/config/files/path-patterns.ts';
import { isInside, convertToPosixPath } from '#cli/system/paths.ts';
import { readGitSetting, readHooksFolder } from '#cli/system/git.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { join, dirname, resolve, basename, relative } from 'node:path';
import { statSync, lstatSync, readdirSync, realpathSync } from 'node:fs';
import { ESLINT_MANIFEST_TOOL } from '#cli/config/configurations/names.ts';
import { PACKAGE_JSON } from '#cli/config/parsers/projects/dependencies.ts';
import { MARKDOWN_EXTENSION } from '#cli/config/repository/files/classify.ts';
import { ciJobSchema, ciDocumentSchema } from '#cli/schemas/repository/setup.ts';
import { listConflictingConfigFiles } from '#cli/repository/setup/config-files.ts';
import { readPackageJson, listToolOnlyPackages } from '#cli/repository/dependencies.ts';
import { type CiJob, type RepositorySetup, type ConflictingConfigFile } from '#cli/types/repository/setup.ts';

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
    LEFTHOOK_NAMES,
    GITLAB_CI_FILE,
    TASK_AFTER_RUN,
    YAML_EXTENSIONS,
    PRE_COMMIT_FILE,
    FOREIGN_CI_FILES,
    GITLAB_CI_FOLDER,
    LEFTHOOK_PREFIXES,
    HOOKS_PATH_SETTING,
    COMMAND_SEPARATORS,
    LEFTHOOK_EXTENSIONS,
    JOB_NAME_SEPARATORS,
    FOREIGN_HOOK_FOLDERS,
    SIMPLE_GIT_HOOKS_KEY,
    GITHUB_WORKFLOWS_FOLDER,
} from '#cli/config/repository/setup/tools.ts';

// Check whether a CI command line runs a linter: eslint, a two-word lint command, or a lint task.
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

// List the files in a folder under a root, without dot files; none when the folder does not exist.
function listFolder(root: string, folder: string): string[] {
    const path = join(root, folder);
    if (statSync(path, { throwIfNoEntry: false }) === undefined) return [];
    const realRoot = realpathSync(root);
    const target = realpathSync(path);
    if (!isInside(relative(realRoot, target))) return [];
    if (!statSync(target).isDirectory()) return [];
    return readdirSync(target)
        .toSorted((left, right) => left.localeCompare(right))
        .filter((entry) => !entry.startsWith('.') || entry === KEPT_DOT_FILE);
}

// List the hook scripts in a folder: its files, without the folders that a hook manager keeps there.
function listHookFiles(root: string, folder: string): string[] {
    return listFolder(root, folder).filter(
        (name) => statSync(join(root, folder, name), { throwIfNoEntry: false })?.isFile() === true,
    );
}

function detectHookFolder(
    root: string,
    folder: string,
    hooksPath: string,
): RepositorySetup['hooks'][number] | undefined {
    if (hooksPath === folder) return undefined;
    const files = listHookFiles(root, folder);
    if (files.length === 0 && lstatSync(join(root, folder), { throwIfNoEntry: false })?.isSymbolicLink() !== true)
        return undefined;
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

// Find the lint commands in the jobs of a CI file.
function listLintCommands(path: string, document: unknown): string[] {
    const parsed = ciDocumentSchema.safeParse(document);
    if (!parsed.success) return [];
    const source = path.startsWith(GITHUB_WORKFLOWS_FOLDER) ? ciDocumentSchema.safeParse(parsed.data['jobs']) : parsed;
    if (!source.success) return [];
    return Object.entries(source.data).flatMap(([name, value]) => {
        if (name.startsWith('.')) return [];
        const job = ciJobSchema.safeParse(value);
        return job.success && isLintJob(name, job.data) ? [`${path}: ${name}`] : [];
    });
}

// Read the folder that core.hooksPath names. Husky points it at its stubs in .husky/_, or at .husky in Husky 8, and
// keeps the hooks of the user in .husky, which the Husky entry lists.
function readHooksPathEntry(root: string, hooksPath: string): RepositorySetup['hooks'] {
    if (hooksPath === '') return [];
    const location = readHooksFolder(root);
    return [{ kind: 'hooksPath', path: hooksPath, files: listHookFiles(dirname(location), basename(location)) }];
}

/**
 * Read the hooks that a clone already runs: another hooks folder, a tool hooks folder, and hook manager settings.
 *
 * @param repositoryRoot the repository to read.
 * @returns each hook setup and its location.
 */
export function readHooks(repositoryRoot: string): RepositorySetup['hooks'] {
    const packageJson = readPackageJson(repositoryRoot, PACKAGE_JSON);
    const packageHooks = packageJson !== undefined && Object.hasOwn(packageJson, SIMPLE_GIT_HOOKS_KEY);
    const written = readGitSetting(repositoryRoot, HOOKS_PATH_SETTING) ?? '';
    // core.hooksPath can name an absolute path or start with ./; compare it with the hook folders as a repository path.
    const hooksPath = convertToPosixPath(relative(repositoryRoot, resolve(repositoryRoot, written))).replace(
        TRAILING_SLASH,
        '',
    );
    const isHuskyPath = hooksPath === HUSKY_PATH || hooksPath.startsWith(`${HUSKY_PATH}/`);
    const foreignHooksPath = isHuskyPath ? '' : hooksPath;
    const hookNames = [
        ...LEFTHOOK_NAMES.flatMap((name) =>
            LEFTHOOK_EXTENSIONS.flatMap((extension) =>
                LEFTHOOK_PREFIXES.map((prefix) => `${prefix}${name}.${extension}`),
            ),
        ),
        PRE_COMMIT_FILE,
    ];
    const present = hookNames.filter(
        (name) => lstatSync(join(repositoryRoot, name), { throwIfNoEntry: false }) !== undefined,
    );
    const lefthook = present.find((name) => name !== PRE_COMMIT_FILE);
    return [
        ...readHooksPathEntry(repositoryRoot, foreignHooksPath),
        ...FOREIGN_HOOK_FOLDERS.map((folder) => detectHookFolder(repositoryRoot, folder, foreignHooksPath)).filter(
            (hook) => hook !== undefined,
        ),
        ...(lefthook === undefined ? [] : [{ kind: 'lefthook' as const, path: lefthook, files: [] }]),
        ...(present.includes(PRE_COMMIT_FILE)
            ? [{ kind: 'pre-commit' as const, path: PRE_COMMIT_FILE, files: [] }]
            : []),
        ...(packageHooks ? [{ kind: 'simple-git-hooks' as const, path: PACKAGE_JSON, files: [] }] : []),
    ];
}

/**
 * Find the existing lint jobs before init proposes a CI job.
 *
 * @param repositoryRoot the repository to read.
 * @param paths the CI files to read.
 * @returns the names of the jobs that already run a linter.
 */
export function readLintJobs(repositoryRoot: string, paths: string[]): string[] {
    return paths
        .filter((path) => !FOREIGN_CI_FILES.has(path))
        .flatMap((path) => {
            const source = findText(repositoryRoot, path);
            if (source === undefined) return [];
            const document = parseYamlFile(path, source);
            return listLintCommands(path, document);
        });
}

/**
 * Find config files to replace, hooks, CI, agent files, and lint folders.
 *
 * @param reads the run cache.
 * @param repository the inventory and parsed package declarations.
 * @returns what to replace, keep, or report.
 */
export function readRepositorySetup(
    reads: ReadCache,
    repository: Pick<Repository, 'files' | 'dependencyFiles'>,
): RepositorySetup {
    const repositoryRoot = reads.root;
    const { files, dependencyFiles } = repository;
    const paths = new Set(files.map((file) => file.path));
    const configurations = readConfigurations();
    const toolOnlyPackages = [...listToolOnlyPackages(dependencyFiles, configurations.values())].toSorted(
        (a, b) => Number(a === PACKAGE_JSON) - Number(b === PACKAGE_JSON),
    );

    const conflictingConfigFiles = listConflictingConfigFiles(repositoryRoot, files, configurations.values());
    return {
        conflictingConfigFiles: [
            ...new Map(
                conflictingConfigFiles.map((entry) => [
                    JSON.stringify([entry.tool, entry.path, entry.table, entry.key]),
                    entry,
                ]),
            ).values(),
        ],
        hooks: readHooks(repositoryRoot),
        ci: [...paths]
            .filter(
                (path) =>
                    FOREIGN_CI_FILES.has(path) ||
                    path === GITLAB_CI_FILE ||
                    ((path.startsWith(GITHUB_WORKFLOWS_FOLDER) || path.startsWith(GITLAB_CI_FOLDER)) &&
                        YAML_EXTENSIONS.some((extension) => path.endsWith(extension))),
            )
            .toSorted((a, b) => a.localeCompare(b)),
        agentFiles: AGENT_FILES.filter((name) => paths.has(name)),
        ruleFolders: RULE_FOLDERS.filter(
            (name) =>
                lstatSync(join(repositoryRoot, name), { throwIfNoEntry: false })?.isSymbolicLink() === true ||
                listFolder(repositoryRoot, name).some((entry) => entry.endsWith(MARKDOWN_EXTENSION)),
        ),
        lintFolders: LINT_FOLDERS.filter((name) => listFolder(repositoryRoot, name).length > 0),
        toolOnlyPackages,
    };
}

/**
 * Check whether generated field edits cover an existing tool settings section.
 *
 * @param configFile the existing file or section.
 * @param fileEdits the generated field edits.
 * @returns whether an edit covers that file and key.
 */
export function isEditedInPlace(configFile: ConflictingConfigFile, fileEdits: ManagedKeys[]): boolean {
    return fileEdits.some(
        (output) => output.path === configFile.path && output.keys.some((field) => field.key[0] === configFile.key),
    );
}
