import ignore from 'ignore';
import { openRoot } from '#cli/platform/filesystem.ts';
import type { Session, PlannedCheck } from '#cli/types/execution/execution.ts';

/**
 * Leave out the files .prettierignore names before either the checker or its fixer receives file arguments.
 * @param session the open session
 * @param check the active native Prettier check with selected files
 * @returns the check with the ignored files left out
 */
export function prettierInputs(session: Session, check: PlannedCheck): PlannedCheck {
    const tree = openRoot(session.root);
    try {
        const read = tree.read('.prettierignore');
        if (read === undefined) return check;
        const matcher = ignore().add(read.bytes.toString('utf8'));
        const files = check.files.filter((file) => !matcher.ignores(file.path));
        return files.length === 0
            ? { ...check, skip: { source: 'ignore', note: 'all selected paths are ignored by .prettierignore' } }
            : { ...check, files };
    } finally {
        tree.close();
    }
}
