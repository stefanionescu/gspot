import { createHash } from 'node:crypto';
import type { Root } from '#cli/types/platform.ts';
import { EXECUTE_BITS } from '#cli/config/platform.ts';
import { openRoot } from '#cli/platform/filesystem.ts';
import { huskyLines } from '#cli/generation/hooks/husky.ts';
import { readOwnership } from '#cli/lifecycle/ownership/owner.ts';
import { blockSpan, currentBlock } from '#cli/lifecycle/managed-blocks.ts';
import { hasConfiguration } from '#cli/lifecycle/configuration/document.ts';
import { HOOK_FILES, SIMPLE_GIT_HOOKS_DIRECTORY as DIRECTORY } from '#cli/config/repository/repository.ts';
import { hookBody, hookPrefix, hookCommand, simpleGitHookCommand } from '#cli/generation/hooks/scripts.ts';

/**
 * Refuse alternate native configuration before writing or verifying package-owned commands.
 * @param files the files repository root
 */
export function requirePackageConfiguration(files: Root): void {
    for (const prefix of ['', '.']) {
        for (const extension of ['cjs', 'js', 'mjs', 'json']) {
            const path = `${prefix}simple-git-hooks.${extension}`;
            if (files.read(path) !== undefined)
                throw new Error(
                    `Retained ${path}: move its hook commands into package.json simple-git-hooks before selecting this integration.`,
                );
        }
    }
}

/**
 * Verify the invocation without owning ownership of authored Husky commands.
 * @param root the repository root
 * @param runner the task runner the policy names, or undefined
 * @returns whether every Husky script carries the current gspot line
 */
export function huskyReady(root: string, runner: string | undefined): boolean {
    const files = openRoot(root);
    try {
        return huskyLines(root, runner).every(({ path, line }) => {
            const current = files.read(path);
            if (current === undefined) return false;
            const text = current.bytes.toString('utf8');
            return blockSpan(text, 'hash') !== undefined && currentBlock(text, 'hash') === line;
        });
    } finally {
        files.close();
    }
}

/**
 * Verify executable integration, including clones without local ownership records.
 * @param root the repository root.
 * @param runner the task runner the policy names, or undefined.
 * @returns whether the package commands and the integration scripts are the current ones.
 */
export function simpleGitHooksReady(root: string, runner: string | undefined): boolean {
    const prefix = hookPrefix(root);
    const entries = readOwnership(root).files;
    const changes = HOOK_FILES.map((name) => ({
        path: ['simple-git-hooks', name],
        value: simpleGitHookCommand(prefix, name),
    }));
    if (!hasConfiguration(root, { path: 'package.json', format: 'json', changes })) return false;
    const files = openRoot(root);
    try {
        requirePackageConfiguration(files);
        return HOOK_FILES.every((name) => {
            const path = `${DIRECTORY}/${name}`;
            const current = files.read(path);
            const original = files.read(`${path}.gspot-original`);
            const expected = hookBody(name, original !== undefined, [hookCommand(name, runner, prefix)]);
            if (current?.bytes.equals(Buffer.from(expected)) !== true) return false;
            if (
                process.platform !== 'win32' &&
                ((current.mode & EXECUTE_BITS) === 0 ||
                    (original !== undefined && (original.mode & EXECUTE_BITS) === 0))
            )
                return false;
            return [path, ...(original === undefined ? [] : [`${path}.gspot-original`])].every((path) => {
                const installed = entries.find((entry) => entry.path === path)?.installed;
                const file = files.read(path);
                return (
                    file !== undefined &&
                    (installed === undefined ||
                        (installed.mode === file.mode &&
                            installed.hash === createHash('sha256').update(file.bytes).digest('hex')))
                );
            });
        });
    } finally {
        files.close();
    }
}
