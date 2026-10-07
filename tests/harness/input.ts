// Build one check input from the session and inventory owned by its test.
import { engineInput } from '#cli/execution/engines.ts';
import type { ToolSession } from '#cli/types/tools/session.ts';
import type { EngineInput } from '#cli/types/execution/runtime.ts';
import type { EngineInputOptions } from '#tests/types/harness/input.ts';

/**
 * Select one check and its source files while retaining the repository inventory for references.
 * @param session the authored policy and inventory opened by the test
 * @param check the selected check name
 * @param options the scope, source paths, and resources owned by the test
 * @returns the engine input
 */
export function buildEngineInput(session: ToolSession, check: string, options: EngineInputOptions = {}): EngineInput {
    const path = options.scope ?? '';
    const scope = session.scopes.find((entry) => entry.scope.path === path);
    if (scope === undefined) throw new Error(`The test repository has no scope at ${path || 'the root'}.`);
    const spec = scope.selected.flatMap((manifest) => manifest.checks).find((entry) => entry.name === check);
    if (spec === undefined) throw new Error(`The test repository selects no check called ${check}.`);
    const paths = options.paths;
    const files =
        paths === undefined
            ? session.repository.files
            : session.repository.files.filter((file) => paths.includes(file.path));
    return {
        ...engineInput(session, { scope, spec, files }),
        repositoryFiles: session.repository.files,
        ...(options.resources === undefined ? {} : { resources: options.resources }),
    };
}
