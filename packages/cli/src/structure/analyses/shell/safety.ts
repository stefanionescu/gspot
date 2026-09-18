import type { Analysis } from '#types/structure.ts';
// The destructive and silencing forms a script may not use outside its owners. Searched: shellcheck, semgrep; the ownership rule is original.
import { pathMatcher } from '#cli/presets/claims.ts';
import { withoutComment } from '#cli/structure/code-lines.ts';
import { SAFETY_LINE_RULES, SAFETY_OWNER_RULES, UNCHECKED_CD } from '#config/shell.ts';

/**
 * One finding per line that discards a failure, sources state, sweeps processes or trees outside an owner, or changes directory unchecked.
 * @param context the check context
 * @param shell the shell index
 * @returns the findings
 */
export const shellSafety: Analysis = async (context, shell) => {
    const safety = context.bashSetting('safety') as { owners?: unknown } | undefined;
    const owners = Array.isArray(safety?.owners) ? (safety.owners as string[]) : [];
    const isOwner = pathMatcher(owners);
    const index = await shell();
    return index.files.flatMap((file) =>
        file.lines.flatMap((line, position) => {
            const code = withoutComment(line);
            const trimmed = code.trim();
            const rules = [...SAFETY_LINE_RULES, ...(isOwner(file.path) ? [] : SAFETY_OWNER_RULES)];
            const found = rules
                .filter(([pattern]) => pattern.test(code))
                .map(([, rule, text]) => context.report(file.path, position + 1, rule, `Here ${text}.`));
            if (UNCHECKED_CD.test(trimmed) && !trimmed.includes('||'))
                found.push(
                    context.report(
                        file.path,
                        position + 1,
                        'unchecked-cd',
                        'cd carries an explicit failure path, such as || exit 1.',
                    ),
                );
            return found;
        }),
    );
};
