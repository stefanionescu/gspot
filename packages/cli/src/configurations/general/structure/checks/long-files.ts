import { getLimit } from '#cli/settings/scopes.ts';
import type { Session } from '#cli/types/tools.ts';
import { readText } from '#cli/system/files/reads.ts';
import { GRAMMAR_NAMES } from '#cli/config/parsers.ts';
import { listCheckedFiles } from '#cli/engine/files.ts';
import type { GrammarName } from '#cli/types/parsers.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import { countCodeLines } from '#cli/parsers/code/comments.ts';
import type { CheckFinding } from '#cli/types/engine/tool-runs.ts';
import { FILE_LINES_RULE } from '#cli/config/configurations/structure.ts';

/**
Reports source files over the code-line limit of their language.

@param session the repository and its tools.
@param planned the scope files and limits.
*/
export async function checkLongFiles(session: Session, planned: PlannedCheck): Promise<CheckFinding[]> {
    const sources = listCheckedFiles(session.scopes, planned).flatMap((file) => {
        const tagged: GrammarName | 'sql' | undefined = file.tags.includes('sql')
            ? 'sql'
            : GRAMMAR_NAMES.find((name) => file.tags.includes(name));
        const language: GrammarName | 'sql' | undefined =
            file.tags.includes('shell') || file.tags.includes('bash') ? 'bash' : tagged;
        if (language === undefined) return [];
        return [{ file, language, limit: getLimit(planned.scope.settings, 'max_file_lines', language) }];
    });
    const findings = await Promise.all(
        sources.map(async ({ file, language, limit }) => {
            const text = readText(session.cache, file.path);
            const count = await countCodeLines(text, language, session);
            return count <= limit
                ? []
                : [
                      {
                          file: file.path,
                          line: 1,
                          rule: FILE_LINES_RULE,
                          message: `This file has ${String(count)} code lines, over the limit of ${String(limit)}.`,
                      },
                  ];
        }),
    );
    return findings.flat();
}
