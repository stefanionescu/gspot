import { z } from 'zod';
import { parse as parseYaml } from 'yaml';
import { isDeepStrictEqual } from 'node:util';
import { openConfinedRoot } from '#cli/lifecycle/confined.ts';
import { hasConfiguration, readOwnership } from '#cli/lifecycle/ownership.ts';
import { hookPrefix, hookCommand } from '#cli/emit/hooks.ts';
import type { ConfigurationOutput } from '#cli/emit/types.ts';

const PATH = '.pre-commit-config.yaml';
const configurationSchema = z.object({
    repos: z
        .array(
            z
                .object({ repo: z.string(), hooks: z.array(z.object({ id: z.string() }).passthrough()).optional() })
                .passthrough(),
        )
        .default([]),
});

/** Own one local pre-commit entry while preserving every unrelated repository node. */
export function preCommitConfiguration(
    root: string,
    runner: string | undefined,
    binary: string | undefined,
): ConfigurationOutput {
    const files = openConfinedRoot(root);
    let source;
    try {
        source = files.read(PATH);
    } finally {
        files.close();
    }
    const config = configurationSchema.parse(source === undefined ? {} : parseYaml(source.bytes.toString('utf8')));
    const prefix = hookPrefix(root);
    const command = [
        'gspot_status=0',
        `(${hookCommand('pre-commit', runner, binary, prefix)}) || gspot_status=$?`,
        'if [ -n "${GSPOT_PRE_COMMIT_RESULT:-}" ]; then printf "%s\\n" "$gspot_status" > "$GSPOT_PRE_COMMIT_RESULT"; fi',
        'exit "$gspot_status"',
    ].join('; ');
    const value = {
        repo: 'local',
        hooks: [
            {
                id: 'gspot',
                name: 'gspot',
                entry: `bash -c '${command.replaceAll("'", "'\"'\"'")}' gspot`,
                language: 'system',
                stages: ['pre-commit'],
                pass_filenames: false,
                always_run: true,
                require_serial: true,
            },
        ],
    };
    const record = readOwnership(root).files.find((entry) => entry.path === PATH);
    const owned = record?.configuration?.fields.find(
        (field) => field.path[0] === 'repos' && typeof field.path[1] === 'number',
    );
    const matching = config.repos.findIndex((repo) => repo.hooks?.some((hook) => hook.id === 'gspot'));
    if (owned === undefined && matching !== -1 && !isDeepStrictEqual(config.repos[matching], value))
        throw new Error(
            'Retained an authored pre-commit hook named gspot. Rename it before selecting the gspot integration.',
        );
    const index = owned?.path[1] ?? (matching === -1 ? config.repos.length : matching);
    return { path: PATH, format: 'yaml', changes: [{ path: ['repos', index!], value }] };
}

/** Verify the selected local entry before preparing native hooks. */
export function preCommitReady(root: string, runner: string | undefined, binary: string | undefined): boolean {
    return hasConfiguration(root, preCommitConfiguration(root, runner, binary));
}
