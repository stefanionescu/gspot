import type { HookName } from '#cli/generation/hooks.ts';
import { hookBody, hookCommand, hookPrefix, simpleGitHookCommand } from '#cli/generation/hooks.ts';
import type { GeneratedProposal } from '#cli/lifecycle/apply.ts';
import { requirePackageConfiguration, simpleGitHooksReady } from '#cli/lifecycle/hooks/state.ts';
import { readOwnership } from '#cli/lifecycle/ownership.ts';
import { openConfinedRoot } from '#cli/platform/filesystem.ts';
import { SIMPLE_GIT_HOOKS_DIRECTORY as DIRECTORY, HOOK_FILES } from '#cli/repository/hooks.ts';
import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';

const manifestSchema = z.object({
    'simple-git-hooks': z
        .object({
            'pre-commit': z.string().optional(),
            'pre-push': z.string().optional(),
            'commit-msg': z.string().optional(),
        })
        .optional(),
});

/**
 * Run only gspot when native initialization exits before the package command.
 * @param root
 * @param name
 * @param runner
 * @param binary
 */
export function simpleGitHookFallback(
    root: string,
    name: HookName,
    runner: string | undefined,
    binary: string | undefined,
): string {
    return hookBody(name, runner, binary, false, [hookCommand(name, runner, binary, hookPrefix(root))]);
}

/**
 * Preserve each authored command in a subprocess before running the gspot check.
 * @param root
 * @param runner
 * @param out
 * @param binary
 */
export function simpleGitHookOutputs(
    root: string,
    runner: string | undefined,
    out: GeneratedProposal,
    binary: string | undefined,
): void {
    const prefix = hookPrefix(root);
    const files = openConfinedRoot(root);
    try {
        requirePackageConfiguration(files);
        const source = files.read('package.json');
        if (source === undefined) throw new Error('simple-git-hooks requires a repository package.json.');
        const config = manifestSchema.parse(JSON.parse(source.bytes.toString('utf8')))['simple-git-hooks'];
        const entries = readOwnership(root).files;
        const recorded = entries.find((entry) => entry.path === 'package.json');
        const changes = HOOK_FILES.map((name) => {
            const field = ['simple-git-hooks', name];
            const owned = recorded?.configuration?.fields.find((entry) => isDeepStrictEqual(entry.path, field));
            const original = owned === undefined ? config?.[name] : owned.original;
            if (original !== undefined && typeof original !== 'string')
                throw new Error(`simple-git-hooks ${name} must be a shell command.`);
            const path = `${DIRECTORY}/${name}`;
            let content: string | undefined;
            if (original === simpleGitHookCommand(prefix, name)) {
                const retained = files.read(`${path}.gspot-original`);
                const installed = entries.find((entry) => entry.path === `${path}.gspot-original`)?.installed;
                const unchanged =
                    installed === undefined
                        ? retained === undefined
                        : retained !== undefined &&
                          installed.mode === retained.mode &&
                          installed.hash === new Bun.CryptoHasher('sha256').update(retained.bytes).digest('hex');
                if (owned === undefined ? !simpleGitHooksReady(root, runner, binary) : !unchanged)
                    throw new Error(
                        'Retained missing or edited simple-git-hooks programs. Restore them before running gspot apply.',
                    );
                content = retained?.bytes.toString('utf8');
                if (retained !== undefined && content !== undefined && !Buffer.from(content).equals(retained.bytes))
                    throw new Error(`Retained non-UTF-8 simple-git-hooks original: ${path}.gspot-original`);
            } else if (original !== undefined) content = `#!/usr/bin/env sh\n${original}\n`;
            if (content !== undefined)
                out.files.push({
                    path: `${path}.gspot-original`,
                    content,
                    readOnly: false,
                    executable: true,
                    kind: 'runner',
                });
            out.files.push({
                path,
                content: hookBody(name, runner, binary, content !== undefined, [
                    hookCommand(name, runner, binary, prefix),
                ]),
                readOnly: false,
                executable: true,
                kind: 'runner',
            });
            return { path: field, value: simpleGitHookCommand(prefix, name) };
        });
        out.configurations.push({ path: 'package.json', format: 'json', changes });
    } finally {
        files.close();
    }
}
