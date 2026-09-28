import { z } from 'zod';
import { isDeepStrictEqual } from 'node:util';
import type { ConfinedRoot } from '#cli/types/platform.ts';
import { openConfinedRoot } from '#cli/platform/filesystem.ts';
import { readOwnership } from '#cli/lifecycle/ownership/owner.ts';
import type { OwnershipEntry } from '#cli/types/lifecycle/lifecycle.ts';
import type { HookName, GeneratedProposal } from '#cli/types/generation.ts';
import { simpleGitHooksReady, requirePackageConfiguration } from '#cli/lifecycle/hooks/state.ts';
import { HOOK_FILES, SIMPLE_GIT_HOOKS_DIRECTORY as DIRECTORY } from '#cli/config/repository/repository.ts';
import { hookBody, hookPrefix, hookCommand, simpleGitHookCommand } from '#cli/generation/hooks/scripts.ts';

const manifestSchema = z.object({
    'simple-git-hooks': z
        .object({
            'pre-commit': z.string().optional(),
            'pre-push': z.string().optional(),
            'commit-msg': z.string().optional(),
        })
        .optional(),
});

function retainedContent(
    files: ConfinedRoot,
    path: string,
    installed: OwnershipEntry['installed'],
    readiness: () => boolean | undefined,
): string | undefined {
    const retained = files.read(`${path}.gspot-original`);
    const current =
        retained === undefined
            ? undefined
            : {
                  mode: retained.mode,
                  hash: new Bun.CryptoHasher('sha256').update(retained.bytes).digest('hex'),
              };
    const expected = installed === undefined ? undefined : { mode: installed.mode, hash: installed.hash };
    const unchanged = isDeepStrictEqual(current, expected);
    if (!(readiness() ?? unchanged))
        throw new Error(
            'Retained missing or edited simple-git-hooks programs. Restore them before running gspot apply.',
        );
    if (retained === undefined) return undefined;
    const content = retained.bytes.toString('utf8');
    if (!Buffer.from(content).equals(retained.bytes))
        throw new Error(`Retained non-UTF-8 simple-git-hooks original: ${path}.gspot-original`);
    return content;
}
/**
 * Preserve each authored command in a subprocess before running the gspot check.
 * @param root the repository root.
 * @param runner the task runner the policy names, or undefined.
 * @param out the generated proposal the integration scripts and package keys are added to.
 * @param binary the pinned executable when no runner resolves gspot.
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
        if (source === undefined)
            throw new Error('The simple-git-hooks integration requires a repository package.json.');
        const config = manifestSchema.parse(JSON.parse(source.bytes.toString('utf8')))['simple-git-hooks'];
        const entries = readOwnership(root).files;
        const recorded = entries.find((entry) => entry.path === 'package.json');
        const changes = HOOK_FILES.map((name) => {
            const field = ['simple-git-hooks', name];
            const owned = recorded?.configuration?.fields.find((entry) => isDeepStrictEqual(entry.path, field));
            const original = owned === undefined ? config?.[name] : owned.original;
            if (original !== undefined && typeof original !== 'string')
                throw new Error(`The simple-git-hooks ${name} entry must be a shell command.`);
            return { name, field, owned, original };
        }).map(({ name, field, owned, original }) => {
            const path = `${DIRECTORY}/${name}`;
            let content: string | undefined;
            if (original === simpleGitHookCommand(prefix, name)) {
                const installed = entries.find((entry) => entry.path === `${path}.gspot-original`)?.installed;
                content = retainedContent(files, path, installed, () =>
                    owned === undefined ? simpleGitHooksReady(root, runner, binary) : undefined,
                );
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
                content: hookBody(name, content !== undefined, [hookCommand(name, runner, binary, prefix)]),
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

/**
 * Run only gspot when native initialization exits before the package command.
 * @param root the repository root
 * @param name the hook
 * @param runner the task runner the policy names, or undefined
 * @param binary the pinned executable when no runner resolves gspot
 * @returns the hook script
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Two hook generators build the direct hook through it; one owner keeps its shape.
export function simpleGitDirectHook(
    root: string,
    name: HookName,
    runner: string | undefined,
    binary: string | undefined,
): string {
    return hookBody(name, false, [hookCommand(name, runner, binary, hookPrefix(root))]);
}
