// What init lists: configuration at conventional paths, hooks, CI, agent files, home-grown lint folders, the runner.
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
    AGENT_FILE_NAMES,
    CONVENTIONAL_CONFIG_PATHS,
    HOOK_DIRECTORIES,
    LINT_FOLDER_NAMES,
    RULES_DIRECTORY_NAMES,
} from '#config/patterns.ts';
import { git } from '#cli/platform/spawn.ts';
import { isLintOnlyManifest } from '#cli/repository/scopes.ts';
import type { ExistingTool, ExistingTooling, ManifestFacts, ScopeInfo, TrackedFile } from '#types/repository.ts';

function listDir(root: string, rel: string): string[] {
    const full = join(root, rel);
    if (!existsSync(full) || !statSync(full).isDirectory()) return [];
    return readdirSync(full)
        .filter((entry) => !entry.startsWith('.') || entry === '.gitkeep')
        .sort();
}

function hasFiles(root: string, rel: string): boolean {
    return listDir(root, rel).length > 0;
}

/** Everything init lists about the tools a repository already has. Reads conventional paths only. */
export function existingTooling(
    root: string,
    files: TrackedFile[],
    scopes: ScopeInfo[],
    facts: ManifestFacts[],
): ExistingTooling {
    const paths = new Set(files.map((file) => file.path));
    const configs: ExistingTool[] = [];
    const prefixes = ['', ...scopes.filter((scope) => scope.path !== '').map((scope) => `${scope.path}/`)];
    for (const [tool, names] of Object.entries(CONVENTIONAL_CONFIG_PATHS)) {
        for (const prefix of prefixes) {
            for (const name of names) {
                const path = `${prefix}${name}`;
                if (paths.has(path) || (name.startsWith('.') && !name.includes('.', 1) && hasFiles(root, path)))
                    configs.push({ tool, path, owned: false });
            }
        }
    }
    const hooks: ExistingTooling['hooks'] = [];
    const hooksPath = git(root, ['config', '--get', 'core.hooksPath'])?.trim();
    if (hooksPath && hooksPath !== '.gspot/hooks')
        hooks.push({ kind: 'hooksPath', path: hooksPath, files: listDir(root, hooksPath) });
    for (const dir of HOOK_DIRECTORIES) {
        if (!hasFiles(root, dir)) continue;
        if (dir === '.husky') hooks.push({ kind: 'husky', path: dir, files: listDir(root, dir) });
        else if (hooksPath !== dir) hooks.push({ kind: 'githooks', path: dir, files: listDir(root, dir) });
    }
    if (paths.has('lefthook.yml') || paths.has('.lefthook.yml'))
        hooks.push({ kind: 'lefthook', path: paths.has('lefthook.yml') ? 'lefthook.yml' : '.lefthook.yml', files: [] });
    const ci = [...paths].filter((path) => path.startsWith('.github/workflows/') && /\.ya?ml$/.test(path)).sort();
    const agentFiles = AGENT_FILE_NAMES.filter((name) => paths.has(name));
    const rulesDirectories = RULES_DIRECTORY_NAMES.filter(
        (name) => hasFiles(root, name) && listDir(root, name).some((entry) => entry.endsWith('.md')),
    );
    const lintFolders = LINT_FOLDER_NAMES.filter((name) => hasFiles(root, name));
    const lintOnlyManifests = facts
        .filter((fact) => fact.kind === 'package.json' && fact.path !== 'package.json' && isLintOnlyManifest(fact))
        .map((fact) => fact.path);
    for (const fact of facts)
        if (fact.kind === 'package.json' && fact.path === 'package.json' && isLintOnlyManifest(fact))
            lintOnlyManifests.push(fact.path);
    let runner: ExistingTooling['runner'] = 'none';
    let runnerFile: string | undefined;
    for (const name of ['mise.toml', '.mise.toml', '.mise/config.toml', '.tool-versions', 'mise.local.toml']) {
        if (paths.has(name)) {
            runner = 'mise';
            runnerFile = name;
            break;
        }
    }
    if (runner === 'none') {
        if (paths.has('bun.lock') || paths.has('bun.lockb')) runner = 'bun';
        else if (paths.has('pnpm-lock.yaml')) runner = 'pnpm';
        else if (paths.has('yarn.lock')) runner = 'yarn';
        else if (paths.has('package-lock.json') || paths.has('package.json')) runner = 'npm';
        else if (paths.has('uv.lock') || paths.has('pyproject.toml')) runner = 'uv';
        if (runner !== 'none') runnerFile = runner === 'uv' ? 'pyproject.toml' : 'package.json';
    }
    return {
        configs,
        hooks,
        ci,
        agentFiles,
        rulesDirectories,
        lintFolders,
        lintOnlyManifests,
        runner,
        ...(runnerFile !== undefined ? { runnerFile } : {}),
    };
}
