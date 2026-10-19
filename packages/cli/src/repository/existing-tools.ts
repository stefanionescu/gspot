// Find existing lint commands, hooks, and tool files.
import { z } from 'zod';
import { parse as parseYaml } from 'yaml';
import { readText } from '#cli/system/files/reads.ts';
import type { SchemaShape } from '#cli/types/shapes.ts';
import type { ReadCache } from '#cli/types/system/files.ts';
import { HOOKS_PATH } from '#cli/config/system/locations.ts';
import { TRAILING_SLASH } from '#cli/config/system/paths.ts';
import { ESLINT_TOOL } from '#cli/config/generation/eslint.ts';
import { readManifests } from '#cli/configurations/manifests.ts';
import { isInside, convertToPosixPath } from '#cli/system/paths.ts';
import { readGitSetting, readHooksFolder } from '#cli/system/git.ts';
import { PACKAGE_JSON } from '#cli/config/parsers/dependency-files.ts';
import { join, dirname, resolve, basename, relative } from 'node:path';
import { MARKDOWN_EXTENSION } from '#cli/config/repository/inventory.ts';
import type { DependencyFile } from '#cli/types/parsers/dependency-files.ts';
import { listToolSettingsFiles } from '#cli/repository/tool-settings-files.ts';
import { statSync, lstatSync, existsSync, readdirSync, realpathSync } from 'node:fs';
import { readPackageJson, listToolOnlyPackages } from '#cli/repository/dependency-files.ts';
import type { CiJob, TrackedFile, ExistingTools } from '#cli/types/repository/inventory.ts';

import {
    HUSKY_PATH,
    HOOK_FOLDERS,
    LEFTHOOK_NAMES,
    PRE_COMMIT_FILE,
    MISE_HOOKS_PATH,
    LEFTHOOK_PREFIXES,
    HOOKS_PATH_SETTING,
    LEFTHOOK_EXTENSIONS,
    SIMPLE_GIT_HOOKS_KEY,
} from '#cli/config/repository/hooks.ts';
import {
    RUN_WORD,
    LINT_TASK,
    LINT_PAIRS,
    LINT_WORDS,
    AGENT_FILES,
    RUNNER_NAMES,
    LINT_FOLDERS,
    RULE_FOLDERS,
    KEPT_DOT_FILE,
    TASK_AFTER_RUN,
    GITLAB_CI_FILE,
    YAML_EXTENSIONS,
    FOREIGN_CI_FILES,
    GITLAB_CI_FOLDER,
    COMMAND_SEPARATORS,
    JOB_NAME_SEPARATORS,
    GITHUB_WORKFLOWS_FOLDER,
} from '#cli/config/repository/existing-tools.ts';

// Check whether a CI command line runs a linter: eslint, a two-word lint command, or a lint task.
function isLintCommand(command: string): boolean {
    const words = command.split(COMMAND_SEPARATORS).filter((word) => word !== '');
    return words.some((word, index) => {
        if (word === ESLINT_TOOL) return true;
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
    if (!existsSync(path)) return [];
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

function detectHookFolder(root: string, folder: string, hooksPath: string): ExistingTools['hooks'][number] | undefined {
    if (hooksPath === folder) return undefined;
    const files = listHookFiles(root, folder);
    if (files.length === 0 && lstatSync(join(root, folder), { throwIfNoEntry: false })?.isSymbolicLink() !== true)
        return undefined;
    return { kind: folder === HUSKY_PATH ? 'husky' : 'githooks', path: folder, files };
}

const ciStepSchema = z.object({ run: z.string().optional() } satisfies SchemaShape<{ run?: string | undefined }>);

const ciJobSchema = z.object({
    script: (
        z.union([
            z.string(),
            z.array(z.unknown()).transform((commands) => commands.filter((command) => typeof command === 'string')),
        ]) satisfies z.ZodType<string | string[]>
    ).optional(),
    steps: z
        .array(z.unknown())
        .transform((steps) =>
            steps.flatMap((step) => {
                const parsed = ciStepSchema.safeParse(step);
                return parsed.success ? [parsed.data] : [];
            }),
        )
        .optional(),
    extends: z.unknown().optional(),
} satisfies SchemaShape<CiJob>);
const ciDocumentSchema = z.record(z.string(), z.unknown()) satisfies z.ZodType<Record<string, unknown>>;

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
function readHooksPathEntry(root: string, hooksPath: string, isHuskyPath: boolean): ExistingTools['hooks'] {
    if (hooksPath === '' || isHuskyPath) return [];
    const location = readHooksFolder(root);
    return [{ kind: 'hooksPath', path: hooksPath, files: listHookFiles(dirname(location), basename(location)) }];
}

/**
 * Read the hooks that a clone already runs: another hooks folder, a tool hooks folder, and hook manager settings.
 * @param repositoryRoot the repository to read.
 * @returns each hook setup and its location.
 */
export function readHooks(repositoryRoot: string): ExistingTools['hooks'] {
    const packageJson = readPackageJson(repositoryRoot, PACKAGE_JSON);
    const packageHooks = packageJson !== undefined && Object.hasOwn(packageJson, SIMPLE_GIT_HOOKS_KEY);
    const written = readGitSetting(repositoryRoot, HOOKS_PATH_SETTING) ?? '';
    // core.hooksPath can name an absolute path or start with ./; compare it with the hook folders as a repository path.
    const hooksPath =
        written === ''
            ? ''
            : convertToPosixPath(relative(repositoryRoot, resolve(repositoryRoot, written))).replace(
                  TRAILING_SLASH,
                  '',
              );
    const isHuskyPath = hooksPath === HUSKY_PATH || hooksPath.startsWith(`${HUSKY_PATH}/`);
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
        ...readHooksPathEntry(repositoryRoot, hooksPath, isHuskyPath),
        ...HOOK_FOLDERS.filter((folder) => folder !== HOOKS_PATH && folder !== MISE_HOOKS_PATH)
            .map((folder) => detectHookFolder(repositoryRoot, folder, isHuskyPath ? '' : hooksPath))
            .filter((hook) => hook !== undefined),
        ...(lefthook === undefined ? [] : [{ kind: 'lefthook' as const, path: lefthook, files: [] }]),
        ...(present.includes(PRE_COMMIT_FILE)
            ? [{ kind: 'pre-commit' as const, path: PRE_COMMIT_FILE, files: [] }]
            : []),
        ...(packageHooks ? [{ kind: 'simple-git-hooks' as const, path: PACKAGE_JSON, files: [] }] : []),
    ];
}

/**
 * Find the existing lint jobs before init proposes a CI job.
 * @param repositoryRoot the repository to read.
 * @param paths the CI files to read.
 * @returns the names of the jobs that already run a linter.
 */
export function readLintJobs(repositoryRoot: string, paths: string[]): string[] {
    return paths
        .filter((path) => !FOREIGN_CI_FILES.has(path))
        .flatMap((path) => {
            const source = readText(repositoryRoot, path);
            if (source === undefined) return [];
            let document: unknown;
            try {
                document = parseYaml(source);
            } catch (error) {
                const detail = error instanceof Error ? error.message : String(error);
                throw new Error(`Cannot read CI configuration ${path}: ${detail}`, { cause: error });
            }
            return listLintCommands(path, document);
        });
}

/**
 * Find tool files to replace, hooks, CI, agent files, and lint folders.
 * @param repositoryRoot the repository to read.
 * @param files the tracked inventory.
 * @param dependencyFiles the parsed package declarations.
 * @param reads the run cache.
 * @returns what to replace, keep, or report.
 */
export function readExistingTools(
    repositoryRoot: string,
    files: TrackedFile[],
    dependencyFiles: DependencyFile[],
    reads: ReadCache,
): ExistingTools {
    const paths = new Set(files.map((file) => file.path));
    const manifests = readManifests(reads);
    const toolOnlyPackages = [...listToolOnlyPackages(dependencyFiles, manifests.values())].toSorted(
        (a, b) => Number(a === PACKAGE_JSON) - Number(b === PACKAGE_JSON),
    );

    const configurations = listToolSettingsFiles(repositoryRoot, files, manifests.values());
    return {
        toolFiles: [
            ...new Map(
                configurations.map((entry) => [
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
