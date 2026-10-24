import type { Session } from '#cli/types/session.ts';
import { readCachedText } from '#cli/system/files/reads.ts';
import { extractRulePrefix } from '#cli/configurations/tools.ts';
import { DIRECTIVE_TAIL, CODE_FILE_TAGS, ESLINT_DIRECTIVE } from '#cli/config/commands/init/eslint-disable-comments.ts';

/**
List the files whose eslint-disable comments name a rule that no plugin of the new setup provides. ESLint reports
such a comment as a rule it cannot find.

@param session the repository and the tools that the selected checks run.
@returns a plan row for each file, with the rules it names.
*/
export function listForeignDisableComments(session: Session): { path: string; note: string }[] {
    const prefixes = new Set(
        session.toolConfigurations.flatMap((configuration) =>
            configuration.tools.flatMap((tool) => (tool.rule_prefix === undefined ? [] : [tool.rule_prefix])),
        ),
    );
    return session.repository.files
        .filter((file) => file.kind === 'source' && file.tags.some((tag) => CODE_FILE_TAGS.has(tag)))
        .flatMap((file) => {
            const text = readCachedText(session.reads, file.path);
            const rules = [...text.matchAll(ESLINT_DIRECTIVE)]
                .flatMap((match) => (match.groups?.['rules'] ?? '').split(DIRECTIVE_TAIL, 1)[0]?.split(',') ?? [])
                .map((rule) => rule.trim())
                .filter((rule) => {
                    const prefix = extractRulePrefix(rule);
                    return prefix !== undefined && !prefixes.has(prefix);
                });
            if (rules.length === 0) return [];
            return [
                {
                    path: file.path,
                    note: `${[...new Set(rules)].join(', ')}: gspot does not load these rules; delete the comments`,
                },
            ];
        });
}
