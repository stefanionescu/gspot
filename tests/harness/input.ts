// Build one check input from the session and inventory owned by its test.
import { toolPath } from '#cli/platform/paths.ts';
import { scopeOf } from '#cli/repository/scopes.ts';
import { checkInput } from '#cli/execution/built-in.ts';
import type { ToolSession } from '#cli/types/tools/session.ts';
import type { CheckInput } from '#cli/types/execution/check.ts';
import type { CheckInputOptions } from '#tests/types/harness/input.ts';

/**
 * Select one check and its source files while retaining the repository inventory for references.
 * @param session the authored policy and inventory opened by the test
 * @param checkId the selected check ID
 * @param options the scope, source paths, and resources owned by the test
 * @returns the check input
 */
export function buildCheckInput(session: ToolSession, checkId: string, options: CheckInputOptions = {}): CheckInput {
    const path = toolPath(options.scope ?? '');
    const scope = session.scopes.find((entry) => entry.scope.path === path);
    if (scope === undefined) throw new Error(`The sandbox has no scope at ${path || 'the root'}.`);
    const check = scope.selected.flatMap((manifest) => manifest.checks).find((entry) => entry.name === checkId);
    if (check === undefined) throw new Error(`The sandbox selects no check called ${checkId}.`);
    const paths = options.paths?.map((source) => toolPath(source));
    const files = session.repository.files.filter(
        (file) =>
            (check.runs === 'once' || scopeOf(file.path, session.repository.scopes).path === path) &&
            (paths === undefined || paths.includes(file.path)),
    );
    return {
        ...checkInput(session, { scope, check, files }),
        repositoryFiles: session.repository.files,
        ...(options.resources === undefined ? {} : { resources: options.resources }),
    };
}
