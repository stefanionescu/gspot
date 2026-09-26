import { pathMatcher } from '#cli/repository/paths.ts';
import { withoutComment } from '#cli/checks/structure/code-lines.ts';
import type { StructureAnalysis as Analysis } from '#cli/types/checks/structure.ts';
import { SAFETY_LINE_RULES, SAFETY_OWNER_RULES, UNCHECKED_CD } from '#cli/constants/checks/script.ts';

/**
 * One finding per line that discards a failure, sources state, sweeps processes or trees outside an owner, or changes directory unchecked.
 * @param context the check context
 * @param scripts the shell index
 * @returns the findings
 */
export const scriptSafety: Analysis = async (context, scripts) => {
    const safety = context.bashSetting('safety') as { owners?: unknown } | undefined;
    const owners = Array.isArray(safety?.owners) ? (safety.owners as string[]) : [];
    const isOwner = pathMatcher(owners);
    const index = await scripts();
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
