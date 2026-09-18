import type { Analysis } from '#types/structure.ts';
// A shell function used once with little in it. Searched: shellcheck; it does not count uses.
import { pathMatcher } from '#cli/presets/claims.ts';
import { ENTRY_FUNCTIONS, MARKERS } from '#config/shell.ts';
import { codeLineCount } from '#cli/structure/code-lines.ts';
import { markedNames } from '#cli/structure/analyses/unused-functions.ts';

const DEFAULT_STATEMENTS = 2;

/**
 * One finding per function referenced once whose body has at most limits.trivial_statements code lines.
 * @param context the check context
 * @param shell the shell index
 * @returns the findings
 */
export const trivialFunction: Analysis = async (context, shell) => {
    const ceiling = context.limit('trivial_statements') ?? DEFAULT_STATEMENTS;
    const exemptions = context.input.session.policyFiles.policy.structure.trivial_exemptions.filter(
        (entry) => entry.language === undefined || entry.language === 'bash',
    );
    const index = await shell();
    const uses = (name: string): number =>
        index.files.reduce((sum, file) => sum + (file.references.get(name)?.length ?? 0), 0);
    return index.files.flatMap((file) => {
        const allowed = markedNames(file, MARKERS.trivialFunction);
        const exempt = new Set(
            exemptions.filter((entry) => pathMatcher([entry.path])(file.path)).flatMap((entry) => entry.names),
        );
        return file.functions.flatMap((entry) => {
            if (ENTRY_FUNCTIONS.includes(entry.name) || allowed.has(entry.name) || exempt.has(entry.name)) return [];
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
