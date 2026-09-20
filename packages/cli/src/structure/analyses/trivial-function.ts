import type { Analysis } from '#types/structure.ts';
// A shell function used once with little in it. Searched: shellcheck; it does not count uses.
import { pathMatcher } from '#cli/presets/claims.ts';
import { ENTRY_FUNCTIONS } from '#config/structure.ts';
import { codeLineCount } from '#cli/structure/code-lines.ts';

const DEFAULT_STATEMENTS = 2;

/**
 * One finding per function referenced once whose body has at most limits.trivial_statements code lines.
 * @param context the check context
 * @param scripts the shell index
 * @returns the findings
 */
export const trivialFunction: Analysis = async (context, scripts) => {
    const ceiling = context.limit('trivial_statements') ?? DEFAULT_STATEMENTS;
    const exemptions = context.input.session.policyFiles.policy.structure.trivial_allowed.filter(
        (entry) => entry.language === undefined || entry.language === 'bash',
    );
    const index = await scripts();
    const uses = (name: string): number =>
        index.files.reduce((sum, file) => sum + (file.references.get(name)?.length ?? 0), 0);
    return index.files.flatMap((file) => {
        const exempt = new Set(
            exemptions.filter((entry) => pathMatcher([entry.path])(file.path)).flatMap((entry) => entry.names),
        );
        return file.functions.flatMap((entry) => {
            if (ENTRY_FUNCTIONS.includes(entry.name) || exempt.has(entry.name)) return [];
            const statements = codeLineCount(entry.body);
            if (statements > ceiling || uses(entry.name) !== 1) return [];
            return [
                context.report(
                    file.path,
                    entry.start,
                    'inline-it',
                    `${entry.name} is used once and has ${String(statements)} statement(s); inline it.`,
                ),
            ];
        });
    });
};
