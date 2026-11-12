import { lstatSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';

import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { PACKAGE_JSON } from '#cli/config/parsers/projects.ts';
import { EXECUTABLE_BITS, MARKDOWN_EXTENSION } from '#cli/config/repository/files.ts';
import {
    AGENT_FILES,
    FOREIGN_CI_FILES,
    FOREIGN_HOOK_FOLDERS,
    GITHUB_WORKFLOWS_FOLDER,
    GITLAB_CI_FILE,
    GITLAB_CI_FOLDER,
    HOOK_SHEBANG,
    HOOKS_PATH_SETTING,
    HUSKY_PATH,
    KEPT_DOT_FILE,
    LEFTHOOK_EXTENSIONS,
    LEFTHOOK_NAMES,
    LEFTHOOK_PREFIXES,
    LFS_GUARD_PREFIX,
    LFS_HOOKS,
    LFS_PUSH_CALLS,
    LINT_FOLDERS,
    PRE_COMMIT_FILE,
    RULE_FOLDERS,
    SAMPLE_HOOK_SUFFIX,
    SIMPLE_GIT_HOOKS_KEY,
    YAML_EXTENSIONS,
} from '#cli/config/repository/setup.ts';
import { LINE_BREAK } from '#cli/config/system.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { listConflictingConfigs } from '#cli/repository/conflicts.ts';
import { readPackageJson } from '#cli/repository/dependencies.ts';
import { readGitSetting, readHooksFolder } from '#cli/repository/git/run.ts';
import { findContainedPath } from '#cli/system/files/reads.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { compareText } from '#cli/system/text.ts';
import type { Repository, RepositoryHooks, RepositorySetup } from '#cli/types/repository.ts';
import type { RunCache } from '#cli/types/system.ts';

function listFolder(root: string, folder: string): string[] {
    if (statSync(join(root, folder), { throwIfNoEntry: false }) === undefined) return [];
    const target = findContainedPath(root, folder);
    if (target === undefined || !statSync(target).isDirectory()) return [];
    return readdirSync(target)
        .toSorted((left, right) => compareText(left, right))
        .filter((name) => !name.startsWith('.') || name === KEPT_DOT_FILE);
}

function listFolderFiles(root: string, folder: string): string[] {
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
    const files = listFolderFiles(root, folder);
    if (files.length === 0) return undefined;
    return { kind: folder === HUSKY_PATH ? 'husky' : 'githooks', path: folder, files };
}

async function readHooksPathSetup(root: string, hooksPath: string): Promise<RepositorySetup['hooks']> {
    if (hooksPath === '') return [];
    const location = await readHooksFolder(root);
    return [
        {
            kind: 'hooksPath',
            path: hooksPath,
            files: listFolderFiles(dirname(location), basename(location)),
        },
    ];
}

async function listHookFolders(root: string, hooksPath: string): Promise<RepositorySetup['hooks']> {
    return [
        ...(await readHooksPathSetup(root, hooksPath)),
        ...FOREIGN_HOOK_FOLDERS.map((folder) => detectHookFolder(root, folder, hooksPath)).filter(
            (hook) => hook !== undefined,
        ),
    ];
}

function listHookTools(root: string): RepositorySetup['hooks'] {
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
    const present = hookNames.filter((name) => statSync(join(root, name), { throwIfNoEntry: false }) !== undefined);
    const lefthook = present.find((name) => name !== PRE_COMMIT_FILE);
    return [
        ...(lefthook === undefined ? [] : [{ kind: 'lefthook' as const, path: lefthook, files: [] }]),
        ...(present.includes(PRE_COMMIT_FILE)
            ? [{ kind: 'pre-commit' as const, path: PRE_COMMIT_FILE, files: [] }]
            : []),
        ...(isPackageHooks ? [{ kind: 'simple-git-hooks' as const, path: PACKAGE_JSON, files: [] }] : []),
    ];
}

function isLfsHookScript(folder: string, name: string): boolean {
    if (!(LFS_HOOKS as readonly string[]).includes(name)) return false;
    const lines = readFileSync(join(folder, name), 'utf8').trim().split(LINE_BREAK);
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
Read the hooks that a clone already runs: another hooks folder, a tool hooks folder, and hook manager settings. A
`.husky`, `.githooks`, or `.git-hooks` folder runs only while core.hooksPath points into it, and a hook manager runs
only after its own install wrote a hook for Git, so a clone that never installed one gets the gspot hooks.
*/
export async function readHooks(repository: Pick<Repository, 'root'>): Promise<RepositoryHooks> {
    const { root } = repository;
    const written = await readGitSetting(root, HOOKS_PATH_SETTING);
    const hooksPath = convertToPosixPath(relative(root, resolve(root, written ?? '')));
    const isHusky = hooksPath === HUSKY_PATH || hooksPath.startsWith(`${HUSKY_PATH}/`);
    const isOwn = hooksPath === GSPOT_PATHS.hooks || isHusky;
    const folders = await listHookFolders(root, isOwn ? '' : hooksPath);
    const gitHooks = await listGitFolderHooks(root);
    const hooks = [
        ...folders.filter(
            (hook) => hook.kind === 'hooksPath' || hooksPath === hook.path || hooksPath.startsWith(`${hook.path}/`),
        ),
        ...(gitHooks.length === 0 ? [] : listHookTools(root)),
        ...(written === undefined ? gitHooks : []),
    ];
    return { hooksPath, hooks };
}

export async function readRepositorySetup(
    cache: RunCache,
    repository: Pick<Repository, 'files'>,
): Promise<RepositorySetup> {
    const root = cache.root;
    const { files } = repository;
    const paths = new Set(files.map((file) => file.path));
    const conflictingConfigs = listConflictingConfigs(root, files, readConfigurations().values());
    const { hooks } = await readHooks({ root });
    return {
        conflictingConfigs: new Map(
            conflictingConfigs.map((conflictingConfig) => [
                JSON.stringify([
                    conflictingConfig.tool,
                    conflictingConfig.path,
                    conflictingConfig.table,
                    conflictingConfig.key,
                ]),
                conflictingConfig,
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
    };
}
