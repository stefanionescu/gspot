import { isDeepStrictEqual } from 'node:util';
import { openRoot } from '#cli/platform/filesystem.ts';
import { ignoredPathsResponse } from '#cli/native/protocol.ts';
import { runConfiguration } from '#cli/native/configuration.ts';
import type { Session, PlannedCheck } from '#cli/types/execution/execution.ts';

/**
 * Resolve native ignore patterns before either the checker or its fixer receives file arguments.
 * @param session the open session
 * @param check the active native Prettier check with selected files
 * @returns the check with the ignored files left out
 */
export async function prettierInputs(session: Session, check: PlannedCheck): Promise<PlannedCheck> {
    const ignorePath = '.prettierignore';
    const tree = openRoot(session.root);
    try {
        const observed = tree.read(ignorePath);
        if (observed === undefined) return check;
        const ignored = new Set(
            ignoredPathsResponse.parse(
                await runConfiguration(
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
        if (!isDeepStrictEqual(tree.read(ignorePath), observed))
            throw new Error('.prettierignore changed while check inputs were resolved. Run gspot check again.');
        const files = check.files.filter((file) => !ignored.has(file.path));
        return files.length === 0
            ? { ...check, skip: { source: 'ignore', note: 'all selected paths are ignored by .prettierignore' } }
            : { ...check, files };
    } finally {
        tree.close();
    }
}
