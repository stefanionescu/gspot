import type { Analysis } from '#cli/structure/types.ts';
// Environment variables the owner declares are read elsewhere only through it. Searched: shellcheck; it has no ownership notion.
import { pathMatcher } from '#cli/presets/claims.ts';
import { withoutComment } from '#cli/structure/code-lines.ts';

function ownerPaths(roles: Record<string, string | string[]>): string[] {
    const env = roles['env'];
    if (env === undefined) return [];
    return Array.isArray(env) ? env : [env];
}

/**
 * One finding per read of an owner-declared variable outside the owner.
 * @param context the check context
 * @param scripts the shell index
 * @returns the findings
 */
export const envAccessOwner: Analysis = async (context, scripts) => {
    const isOwner = pathMatcher(ownerPaths(context.input.session.policyFiles.policy.architecture.roles));
    const index = await scripts();
    const owned = new Set(index.files.filter((file) => isOwner(file.path)).flatMap((file) => [...file.assignments]));
    if (owned.size === 0) return [];
    const read = new RegExp(String.raw`\$\{?(${[...owned].join('|')})\b`, 'u');
    return index.files.flatMap((file) => {
        if (isOwner(file.path)) return [];
        return file.lines.flatMap((line, position) => {
            const match = read.exec(withoutComment(line));
            if (match?.[1] === undefined) return [];
            return [
                context.report(
                    file.path,
                    position + 1,
                    'read-outside-owner',
                    `${match[1]} is read here but declared by the environment owner; read it there and pass the value in.`,
                ),
            ];
        });
    });
};
