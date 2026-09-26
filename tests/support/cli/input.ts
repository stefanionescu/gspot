import { join } from 'node:path';
import { stringify } from 'smol-toml';
import { engineInput } from '#cli/execution/engines.ts';
import { openSession } from '#cli/execution/session.ts';
import type { EngineInput } from '#cli/types/checks/checks.ts';

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

/**
 * The input of a check the sandbox's own policy selects, over every tracked file of the root scope.
 * @param root the sandbox, already holding its gspot.toml
 * @param check the check name
 * @returns the engine input
 */
export async function sessionInput(root: string, check: string): Promise<EngineInput> {
    const session = await openSession(root);
    const scope = session.scopes.find((entry) => entry.scope.path === '');
    if (scope === undefined) throw new Error('The sandbox has no root scope.');
    const spec = scope.selected.flatMap((manifest) => manifest.checks).find((entry) => entry.name === check);
    if (spec === undefined) throw new Error(`The sandbox selects no check called ${check}.`);
    return engineInput(session, { scope, spec, files: session.repository.files });
}
