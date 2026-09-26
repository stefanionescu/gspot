import { isDeepStrictEqual } from 'node:util';
import type { Session } from '#cli/execution/session.ts';
import type { PlannedCheck } from '#cli/execution/plan.ts';
import { openConfinedRoot } from '#cli/platform/filesystem.ts';
import { ignoredPathsResponse } from '#cli/evaluation/protocol.ts';
import { evaluateConfiguration } from '#cli/evaluation/configuration.ts';

/**
 * Resolve native ignore patterns before either the checker or its fixer receives file arguments.
 * @param session the open session
 * @param check the planned Prettier check
 * @returns the check with the ignored files left out
 */
export async function prettierInputs(session: Session, check: PlannedCheck): Promise<PlannedCheck> {
    if (
        check.manifest?.configuration.name !== 'formatting' ||
        check.check !== 'formatting/prettier' ||
        check.skip !== undefined ||
        check.files.length === 0
    )
        return check;
    const ignorePath = '.prettierignore';
    const confined = openConfinedRoot(session.root);
    try {
        const observed = confined.read(ignorePath);
        if (observed === undefined) return check;
        const ignored = new Set(
            ignoredPathsResponse.parse(
                await evaluateConfiguration(
                    {
                        tool: 'prettier',
                        operation: 'ignore',
                        root: session.root,
                        paths: check.files.map((file) => file.path),
                        ignorePath,
                    },
                    check.scope.view,
                    session.cancelSignal,
                ),
            ),
        );
        if (!isDeepStrictEqual(confined.read(ignorePath), observed))
            throw new Error('.prettierignore changed while check inputs were resolved. Run gspot check again.');
        const files = check.files.filter((file) => !ignored.has(file.path));
        return files.length === 0
            ? { ...check, skip: { source: 'ignore', note: 'all selected paths are ignored by .prettierignore' } }
            : { ...check, files };
    } finally {
        confined.close();
    }
}
