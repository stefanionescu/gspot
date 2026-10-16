// Finds existing lint commands, hooks, and tool files.
import { z } from 'zod';
import picomatch from 'picomatch';
import { parse as parseYaml } from 'yaml';
import { parse as parseToml } from 'smol-toml';
import { isInside } from '#cli/system/paths.ts';
import { isRecord } from '#cli/system/values.ts';
import { parseJsonFile } from '#cli/parsers/json.ts';
import { readText } from '#cli/system/files/reads.ts';
import type { SchemaShape } from '#cli/types/objects.ts';
import type { ReadCache } from '#cli/types/system/files.ts';
import { isInGspotFolder } from '#cli/repository/classify.ts';
import { ESLINT_TOOL } from '#cli/config/generation/eslint.ts';
import { buildPathMatcher } from '#cli/repository/matchers.ts';
import { listNpmToolNames } from '#cli/configurations/tools.ts';
import { readManifests } from '#cli/configurations/manifests.ts';
import { HOOKS_DIRECTORY } from '#cli/config/system/locations.ts';
import type { ToolDeclaration } from '#cli/types/configurations.ts';
import { readGitSetting, readHooksFolder } from '#cli/system/git.ts';
import { PACKAGE_JSON } from '#cli/config/parsers/dependency-files.ts';
import { join, extname, dirname, basename, relative } from 'node:path';
import { MARKDOWN_EXTENSION } from '#cli/config/repository/inventory.ts';
import type { DependencyFile } from '#cli/types/parsers/dependency-files.ts';
import { statSync, lstatSync, existsSync, readdirSync, realpathSync } from 'node:fs';
import { readPackageJson, isToolOnlyPackage } from '#cli/repository/dependency-files.ts';
import type { CiJob, TrackedFile, ExistingTools, FoundToolFile } from '#cli/types/repository/inventory.ts';

import {
    LEFTHOOK_NAMES,
    HUSKY_DIRECTORY,
    PRE_COMMIT_FILE,
    HOOK_DIRECTORIES,
    LEFTHOOK_PREFIXES,
    HOOKS_PATH_SETTING,
    LEFTHOOK_EXTENSIONS,
    MISE_HOOK_DIRECTORY,
    SIMPLE_GIT_HOOKS_KEY,
} from '#cli/config/repository/hooks.ts';
import {
    RUN_WORD,
    LINT_TASK,
    LINT_PAIRS,
    LINT_WORDS,
    AGENT_FILES,
    RUNNER_NAMES,
    KEPT_DOT_FILE,
    TASK_AFTER_RUN,
    GITLAB_CI_FILE,
    INI_EXTENSIONS,
    YAML_EXTENSIONS,
    FOREIGN_CI_FILES,
    LINT_DIRECTORIES,
    GITLAB_CI_FOLDER,
    RULES_DIRECTORIES,
    COMMAND_SEPARATORS,
    JOB_NAME_SEPARATORS,
    GITHUB_WORKFLOWS_FOLDER,
} from '#cli/config/repository/existing-tools.ts';

// Whether a CI command line runs a linter: eslint, a two-word lint command, or a runner's lint task.
function isLintCommand(command: string): boolean {
    const runners = new Set<string>(RUNNER_NAMES);
    const words = command.split(COMMAND_SEPARATORS).filter((word) => word !== '');
    return words.some((word, index) => {
        if (word === ESLINT_TOOL) return true;
        const next = words[index + 1];
        if (next !== undefined && LINT_PAIRS.has(`${word} ${next}`)) return true;
        if (!runners.has(word)) return false;
        const task = next === RUN_WORD ? words[index + TASK_AFTER_RUN] : next;
        return task === LINT_TASK;
    });
}

// The files in a folder under a root, without dot files; none when the folder does not exist.
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

function detectHookFolder(root: string, folder: string, hooksPath: string): ExistingTools['hooks'][number] | undefined {
    if (hooksPath === folder) return undefined;
    const files = listFolder(root, folder);
    if (files.length === 0 && lstatSync(join(root, folder), { throwIfNoEntry: false })?.isSymbolicLink() !== true)
        return undefined;
    return { kind: folder === HUSKY_DIRECTORY ? 'husky' : 'githooks', path: folder, files };
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

// Find lint commands in the CI document's jobs.
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

// The tool files one replace row finds among tracked files.
function findReplacedToolFiles(
    root: string,
    inventory: Set<string>,
    tool: string,
    replace: NonNullable<ToolDeclaration['replace']>[number],
): FoundToolFile[] {
    const matches = buildPathMatcher([replace.file, `**/${replace.file}`]);
    const candidates = new Set(inventory);
    if (
        !picomatch.scan(replace.file).isGlob &&
        !candidates.has(replace.file) &&
        readText(root, replace.file) !== undefined
    )
        candidates.add(replace.file);
    return [...candidates]
        .filter((candidate) => matches(candidate))
        .filter((path) => {
            const source = readText(root, path);
            if (source === undefined) return false;
            return (replace.table === undefined && replace.key === undefined) || hasToolSection(source, path, replace);
        })
        .map((path) => ({
            tool,
            path,
            shared: replace.shared,
            ...(replace.table === undefined ? {} : { table: replace.table }),
            ...(replace.key === undefined ? {} : { key: replace.key }),
        }));
}

function parseSharedFile(text: string, extension: string, path: string): unknown {
    if (extension === '.json') return parseJsonFile(path, text);
    if (YAML_EXTENSIONS.includes(extension)) return parseYaml(text) as unknown;
    if (extension === '.toml') return parseToml(text);
    throw new Error(`${path}: shared configuration format is unsupported.`);
}

/**
 * Whether a shared tool file contains the declared key or table.
 * @param text the file text.
 * @param path the file path, whose extension names the format.
 * @param selector the key or table that the tool owns.
 * @returns whether that section exists.
 */
function hasToolSection(
    text: string,
    path: string,
    selector: Pick<NonNullable<ToolDeclaration['replace']>[number], 'key' | 'table'>,
): boolean {
    const extension = extname(path);
    if (selector.table !== undefined && INI_EXTENSIONS.has(extension)) return hasIniSection(text, selector.table);
    const parts = selector.key === undefined ? (selector.table as string).split('.') : [selector.key];
    let value = parseSharedFile(text, extension, path);
    for (const part of parts) {
        if (!isRecord(value) || !Object.hasOwn(value, part)) return false;
        value = value[part];
    }
    return true;
}

/**
 * The hooks a clone already runs: another hooks folder, a hook folder a tool keeps, and hook manager settings.
 * @param root the repository root.
 * @returns each set of hooks with where it lives.
 */
export function readHooks(root: string): ExistingTools['hooks'] {
    const manifest = readPackageJson(root, PACKAGE_JSON);
    const packageHooks = manifest !== undefined && Object.hasOwn(manifest, SIMPLE_GIT_HOOKS_KEY);
    const hooksPath = readGitSetting(root, HOOKS_PATH_SETTING) ?? '';
    const location = hooksPath === '' ? undefined : readHooksFolder(root);
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
        ...(location === undefined
            ? []
            : [
                  {
                      kind: 'hooksPath' as const,
                      path: hooksPath,
                      files: listFolder(dirname(location), basename(location)),
                  },
              ]),
        ...HOOK_DIRECTORIES.filter((dir) => dir !== HOOKS_DIRECTORY && dir !== MISE_HOOK_DIRECTORY)
            .map((dir) => detectHookFolder(root, dir, hooksPath))
            .filter((hook) => hook !== undefined),
        ...(lefthook === undefined ? [] : [{ kind: 'lefthook' as const, path: lefthook, files: [] }]),
        ...(present.includes(PRE_COMMIT_FILE)
            ? [{ kind: 'pre-commit' as const, path: PRE_COMMIT_FILE, files: [] }]
            : []),
        ...(packageHooks ? [{ kind: 'simple-git-hooks' as const, path: PACKAGE_JSON, files: [] }] : []),
    ];
}

/**
 * Identify existing lint jobs before proposing another CI job.
 * @param root the repository root.
 * @param paths the CI files to read.
 * @returns the names of the jobs that already run a linter.
 */
export function readLintJobs(root: string, paths: string[]): string[] {
    return paths
        .filter((path) => !FOREIGN_CI_FILES.has(path))
        .flatMap((path) => {
            const source = readText(root, path);
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
 * @param root the repository root.
 * @param files the tracked files.
 * @param packageManifests the parsed package manifests.
 * @param reads the cached file reads for this run.
 * @returns tool files, hooks, CI, agent files, and lint folders.
 */
export function readExistingTools(
    root: string,
    files: TrackedFile[],
    packageManifests: DependencyFile[],
    reads?: ReadCache,
): ExistingTools {
    const paths = new Set(files.map((file) => file.path));
    const manifests = readManifests(reads);
    const npmNames = listNpmToolNames(manifests.values());
    const lintOnlyManifests = packageManifests
        .filter((fact) => fact.kind === 'package.json' && isToolOnlyPackage(fact, npmNames))
        .map((fact) => fact.path)
        .toSorted((a, b) => Number(a === PACKAGE_JSON) - Number(b === PACKAGE_JSON));

    const inventory = new Set(
        files.filter((file) => file.kind === 'source' && !isInGspotFolder(file.path)).map((file) => file.path),
    );
    const configurations = [...manifests.values()].flatMap((manifest) =>
        manifest.tools.flatMap((tool) =>
            (tool.replace ?? []).flatMap((replace) => findReplacedToolFiles(root, inventory, tool.name, replace)),
        ),
    );
    return {
        toolFiles: [
            ...new Map(
                configurations.map((entry) => [
                    JSON.stringify([entry.tool, entry.path, entry.table, entry.key]),
                    entry,
                ]),
            ).values(),
        ],
        hooks: readHooks(root),
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
        rulesDirectories: RULES_DIRECTORIES.filter(
            (name) =>
                lstatSync(join(root, name), { throwIfNoEntry: false })?.isSymbolicLink() === true ||
                listFolder(root, name).some((entry) => entry.endsWith(MARKDOWN_EXTENSION)),
        ),
        lintFolders: LINT_DIRECTORIES.filter((name) => listFolder(root, name).length > 0),
        lintOnlyManifests,
    };
}

/**
 * Identify one INI section or its colon-delimited subsections.
 * @param text the INI text.
 * @param section the section name.
 * @returns whether the file contains the section.
 */
export function hasIniSection(text: string, section: string): boolean {
    const header = new RegExp(String.raw`^\s*\[${RegExp.escape(section)}(?::[^\]]+)?\]\s*(?:[#;].*)?$`, 'mu');
    return header.test(text);
}
