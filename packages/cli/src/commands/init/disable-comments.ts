// Finds lint disable comments that name rules of a plugin that the new setup does not load.
import type { Session } from '#cli/types/planning.ts';
import { readCachedText } from '#cli/system/files/reads.ts';
import { CODE_FILE_TAGS, DIRECTIVE_TAIL, ESLINT_DIRECTIVE } from '#cli/config/commands/init.ts';

// A rule ID names its plugin before its last slash, such as @next/next/no-img-element; core rules name none.
function readPluginPrefix(rule: string): string | undefined {
    const slash = rule.lastIndexOf('/');
    return slash === -1 ? undefined : rule.slice(0, slash);
}

/**
 * List the files whose eslint-disable comments name a rule that no plugin of the new setup provides. ESLint reports
 * such a comment as a rule it cannot find.
 * @param session the repository and the tools that the selected checks run.
 * @returns a plan row for each file, with the rules it names.
 */
export function listForeignDisableComments(session: Session): { path: string; note: string }[] {
    const prefixes = new Set(
        session.neededToolManifests.flatMap((manifest) =>
            manifest.tools.flatMap((tool) => (tool.rule_prefix === undefined ? [] : [tool.rule_prefix])),
        ),
    );
    return session.repository.files
        .filter((file) => file.kind === 'source' && file.tags.some((tag) => CODE_FILE_TAGS.has(tag)))
        .flatMap((file) => {
            const text = readCachedText(session.reads, file.path) ?? '';
            const rules = [...text.matchAll(ESLINT_DIRECTIVE)]
                .flatMap((match) => (match.groups?.['rules'] ?? '').split(DIRECTIVE_TAIL, 1)[0]?.split(',') ?? [])
                .map((rule) => rule.trim())
                .filter((rule) => {
                    const prefix = readPluginPrefix(rule);
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
