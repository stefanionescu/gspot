import { join } from 'node:path';
import { stringify } from 'smol-toml';
import { openSession } from '#cli/run/session.ts';
import { engineInput } from '#cli/run/engines.ts';
import type { EngineInput } from '#cli/checks/input.ts';

/** Construct a check input from validated policy and the observed fixture inventory. */
export async function checkInput(
    root: string,
    check: string,
    paths: string[],
    policy: Record<string, unknown> = {},
): Promise<EngineInput> {
    await Bun.write(
        join(root, 'gspot.toml'),
        stringify({ version: 1, level: 'all', configurations: ['docs'], ...policy }),
    );
    const session = await openSession(root);
    const scope = session.scopes[0]!;
    const spec = [...session.manifests.values()]
        .flatMap((manifest) => manifest.checks)
        .find((spec) => spec.name === check);
    if (spec === undefined) throw new Error(`Unknown fixture check ${check}.`);
    return {
        ...engineInput(session, {
            scope,
            spec,
            files: session.repository.files.filter((file) => paths.includes(file.path)),
        }),
        repositoryFiles: session.repository.files,
    };
}
