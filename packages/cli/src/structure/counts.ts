// The ast-grep counts per function: branches, nesting and mutable assignments against [limits.bash].
import type { Finding } from '#types/finding.ts';
import { functionAt } from '#cli/structure/parser.ts';
import { astGrepMatches } from '#cli/structure/ast-grep.ts';
import type { AstGrepMatch, ShellIndex, StructureContext } from '#types/structure.ts';

const RULES: Record<string, { limit: string; noun: string; isDepth: boolean }> = {
    'shell-branches': { limit: 'function_branches', noun: 'branches', isDepth: false },
    'shell-nesting': { limit: 'function_nesting', noun: 'levels of nesting', isDepth: true },
    'shell-mutable-assignments': { limit: 'mutable_assignments', noun: 'assignments', isDepth: false },
};
const OUTER_LEVELS = 2;

function depthOf(match: AstGrepMatch, siblings: AstGrepMatch[]): number {
    const containing = siblings.filter(
        (other) =>
            other !== match &&
            other.range.start.line <= match.range.start.line &&
            other.range.end.line >= match.range.end.line,
    );
    return containing.length + OUTER_LEVELS;
}

function scoreFor(matches: AstGrepMatch[], isDepth: boolean): number {
    if (!isDepth) return matches.length;
    return matches.reduce((deepest, match) => Math.max(deepest, depthOf(match, matches)), matches.length === 0 ? 0 : 1);
}

/**
 * Runs one count rule over the scope's scripts and reports every function over its limit.
 * @param analysis the check's analysis name, which is also the rule file's stem
 * @param context the check context
 * @param index the shell index
 * @returns the findings; none when ast-grep is not installed
 */
export function countFindings(analysis: string, context: StructureContext, index: ShellIndex): Finding[] {
    const rule = RULES[analysis];
    const ceiling = rule === undefined ? undefined : context.limit(rule.limit, 'bash');
    if (rule === undefined || ceiling === undefined) return [];
    const matches = astGrepMatches(
        context.input.root,
        `presets/bash/rules/${analysis}.yml`,
        index.files.map((file) => file.path),
    );
    if (matches === undefined) return [];
    return index.files.flatMap((file) => {
        const inFile = matches.filter((match) => match.file === file.path);
        return file.functions.flatMap((entry) => {
            const own = inFile.filter(
                (match) => functionAt(file.functions, match.range.start.line + 1)?.start === entry.start,
            );
            const score = scoreFor(own, rule.isDepth);
            if (score <= ceiling) return [];
            return [
                context.report(
                    file.path,
                    entry.start,
                    rule.limit.replaceAll('_', '-'),
                    `${entry.name} has ${String(score)} ${rule.noun}, over the ceiling of ${String(ceiling)}.`,
                ),
            ];
        });
    });
}
