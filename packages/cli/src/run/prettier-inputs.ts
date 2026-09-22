import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { evaluateConfiguration } from '#cli/lifecycle/configuration.ts';
import { ignoredPathsResponse } from '#cli/lifecycle/format-evaluation.ts';
import type { PlannedCheck, Session } from '#cli/run/types.ts';

/** Resolve native ignore patterns before either the checker or its fixer receives file arguments. */
export async function prettierInputs(session: Session, check: PlannedCheck): Promise<PlannedCheck> {
    if (
        check.manifest?.preset.name !== 'formatting' ||
        check.check !== 'formatting/prettier' ||
        check.skip !== undefined ||
        check.files.length === 0
    )
        return check;
    const ignorePath = '.prettierignore';
    const fullPath = join(session.root, ignorePath);
    let observed: Buffer;
    try {
        observed = readFileSync(fullPath);
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return check;
        throw error;
    }
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
    if (!readFileSync(fullPath).equals(observed))
        throw new Error('.prettierignore changed while check inputs were resolved. Run gspot check again.');
    const files = check.files.filter((file) => !ignored.has(file.path));
    return files.length === 0
        ? { ...check, skip: { source: 'ignore', note: 'all selected paths are ignored by .prettierignore' } }
        : { ...check, files };
}
