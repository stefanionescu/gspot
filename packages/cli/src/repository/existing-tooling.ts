// What init lists: configuration at conventional paths, hooks, CI, agent files, home-grown lint folders, the runner.
import { join } from 'node:path';
import { git } from '#cli/platform/spawn.ts';
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
    return Object.entries(CONVENTIONAL_CONFIG_PATHS).flatMap(([tool, names]) =>
        prefixes.flatMap((prefix) =>
            names
                .filter((name) => isConfigurationPresent(root, paths, name, `${prefix}${name}`))
                .map((name): ExistingTool => ({ tool, path: `${prefix}${name}` })),
        ),
    );
}

function hookDirectory(root: string, dir: string, hooksPath: string): ExistingTooling['hooks'][number] | undefined {
    if (!hasFiles(root, dir)) return undefined;
    if (dir === '.husky') return { kind: 'husky', path: dir, files: listDir(root, dir) };
    return hooksPath === dir ? undefined : { kind: 'githooks', path: dir, files: listDir(root, dir) };
}

function hooksFound(root: string, paths: Set<string>): ExistingTooling['hooks'] {
    const hooksPath = git(root, ['config', '--get', 'core.hooksPath'])?.trim() ?? '';
    const isForeignPath = hooksPath !== '' && hooksPath !== '.gspot/hooks';
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
    return path.startsWith('.github/workflows/') && (path.endsWith('.yml') || path.endsWith('.yaml'));
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
        configs: conventionalConfigs(root, paths, scopes),
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
