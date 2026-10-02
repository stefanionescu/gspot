// Engine inputs for tests that call a check's analysis directly.
import { join } from 'node:path';
import { stringify } from 'smol-toml';
import type { CheckSpec } from '#cli/types/kits.ts';
import { engineInput } from '#cli/execution/engines.ts';
import { openSession } from '#cli/execution/session.ts';
import type { Session } from '#cli/types/tools/tools.ts';
import type { EngineInput } from '#cli/types/execution/execution.ts';

/** Construct a check input from validated policy and the read fixture inventory. */
export async function checkInput(
    root: string,
    check: string,
    paths: string[],
    policy: Record<string, unknown> = {},
): Promise<EngineInput> {
    await Bun.write(join(root, 'gspot.toml'), stringify({ level: 'all', kits: ['docs'], ...policy }));
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

/**
 * The input of one check for one scope of an open session, over every tracked file.
 * @param session the open session
 * @param spec the check
 * @param path the scope path, '' for the root
 * @returns the engine input
 */
export function scopeInput(session: Session, spec: CheckSpec, path = ''): EngineInput {
    const scope = session.scopes.find((entry) => entry.scope.path === path);
    if (scope === undefined) throw new Error(`The sandbox has no scope at ${path || 'the root'}.`);
    return engineInput(session, { scope, spec, files: session.repository.files });
}
