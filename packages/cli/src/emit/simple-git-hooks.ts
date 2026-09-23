import { HOOK_FILES } from '#cli/checks/integrity-definitions.ts';
import { hookBody, hookCommand, hookPrefix } from '#cli/emit/hooks.ts';
import type { GeneratedProposal, HookName } from '#cli/emit/types.ts';
import { hasConfiguration } from '#cli/lifecycle/configuration-document.ts';
import { openConfinedRoot } from '#cli/lifecycle/confined.ts';
import { readOwnership } from '#cli/lifecycle/ownership.ts';
import type { ConfinedRoot } from '#cli/lifecycle/types.ts';
import type { Session } from '#cli/run/types.ts';
import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';

const DIRECTORY = '.gspot/integrations/simple-git-hooks';

const manifestSchema = z.object({
    'simple-git-hooks': z
        .object({
            'pre-commit': z.string().optional(),
            'pre-push': z.string().optional(),
            'commit-msg': z.string().optional(),
        })
        .optional(),
});

function requirePackageConfiguration(files: ConfinedRoot): void {
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

/** Invoke the generated integration from the Git working directory. */
export function simpleGitHookCommand(prefix: string, name: string): string {
    return `bash '${`${prefix}${DIRECTORY}/${name}`.replaceAll("'", "'\"'\"'")}' "$@"`;
}

/** Run only gspot when native initialization exits before the package command. */
export function simpleGitHookFallback(
    root: string,
    name: HookName,
    runner: string | undefined,
    binary: string | undefined,
): string {
    return hookBody(name, runner, binary, false, [hookCommand(name, runner, binary, hookPrefix(root))]);
}

/** Preserve each authored command in a subprocess before running the gspot check. */
export function simpleGitHookOutputs(session: Session, out: GeneratedProposal, binary: string | undefined): void {
    const prefix = hookPrefix(session.root);
    const runner = session.policyFiles.policy.runner?.tool;
    const files = openConfinedRoot(session.root);
    try {
        requirePackageConfiguration(files);
        const source = files.read('package.json');
        if (source === undefined) throw new Error('simple-git-hooks requires a repository package.json.');
        const config = manifestSchema.parse(JSON.parse(source.bytes.toString('utf8')))['simple-git-hooks'];
        const entries = readOwnership(session.root).files;
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
                if (owned === undefined ? !simpleGitHooksReady(session.root, runner, binary) : !unchanged)
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

/** Verify executable integration, including clones without local ownership records. */
export function simpleGitHooksReady(root: string, runner: string | undefined, binary: string | undefined): boolean {
    const prefix = hookPrefix(root);
    const entries = readOwnership(root).files;
    const changes = HOOK_FILES.map((name) => ({
        path: ['simple-git-hooks', name],
        value: simpleGitHookCommand(prefix, name),
    }));
    if (!hasConfiguration(root, { path: 'package.json', format: 'json', changes })) return false;
    const files = openConfinedRoot(root);
    try {
        requirePackageConfiguration(files);
        return HOOK_FILES.every((name) => {
            const path = `${DIRECTORY}/${name}`;
            const current = files.read(path);
            const original = files.read(`${path}.gspot-original`);
            const expected = hookBody(name, runner, binary, original !== undefined, [
                hookCommand(name, runner, binary, prefix),
            ]);
            if (current === undefined || !current.bytes.equals(Buffer.from(expected))) return false;
            if (
                process.platform !== 'win32' &&
                ((current.mode & 0o111) === 0 || (original !== undefined && (original.mode & 0o111) === 0))
            )
                return false;
            return [path, ...(original === undefined ? [] : [`${path}.gspot-original`])].every((path) => {
                const installed = entries.find((entry) => entry.path === path)?.installed;
                const file = files.read(path);
                return (
                    file !== undefined &&
                    (installed === undefined ||
                        (installed.mode === file.mode &&
                            installed.hash === new Bun.CryptoHasher('sha256').update(file.bytes).digest('hex')))
                );
            });
        });
    } finally {
        files.close();
    }
}
