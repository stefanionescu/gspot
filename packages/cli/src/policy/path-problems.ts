// The paths a policy names that must exist in the repository: the scope directories.
import * as messages from '#cli/policy/messages.ts';
import { openRoot } from '#cli/platform/filesystem.ts';
import type { Policy, PathSegment, PolicyProblem } from '#cli/types/policy/policy.ts';

// The problems a reader finds, or the error it threw, attributed to the policy value being read.
function guarded(location: PathSegment[], read: () => PolicyProblem[]): PolicyProblem[] {
    try {
        return read();
    } catch (error) {
        return [{ path: location, message: String(error) }];
    }
}

// Duplicate scope declarations after case and Unicode normalization.
function duplicateScopeProblems(paths: string[]): PolicyProblem[] {
    const seen = new Set<string>();
    const problems: PolicyProblem[] = [];
    for (const [index, path] of paths.entries()) {
        const key = path.normalize('NFC').toLowerCase();
        if (seen.has(key))
            problems.push({
                path: ['scope', index, 'path'],
                message: `Scope path is declared more than once: ${path}.`,
            });
        seen.add(key);
    }
    return problems;
}

/**
 * Validate that every scope names a directory of the repository, once.
 * @param root the repository root
 * @param policy the normalized policy
 * @returns the problems in plain English
 */
export function pathProblems(root: string, policy: Policy): PolicyProblem[] {
    const paths = policy.scopes.map((scope) => scope.path);
    const files = openRoot(root);
    try {
        const missing = paths.flatMap((path, index) => {
            const location: PathSegment[] = ['scope', index, 'path'];
            return guarded(location, () =>
                files.stat(path)?.isDirectory() === true
                    ? []
                    : [{ path: location, message: messages.scopeMissing(path) }],
            );
        });
        return [...missing, ...duplicateScopeProblems(paths)];
    } finally {
        files.close();
    }
}
