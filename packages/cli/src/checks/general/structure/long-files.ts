import { getLimit } from '#cli/settings/scopes.ts';
import type { Session } from '#cli/types/session.ts';
import { listCheckedFiles } from '#cli/planning/files.ts';
import { countCodeLines } from '#cli/checks/code-lines.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { readCachedText } from '#cli/system/files/reads.ts';
import type { CheckFinding } from '#cli/types/runs/check.ts';
import { GRAMMAR_NAMES } from '#cli/config/parsers/code/grammars.ts';
import type { GrammarName } from '#cli/types/parsers/code/grammars.ts';
import { FILE_LINES_RULE } from '#cli/config/checks/general/structure/long-files.ts';

/**
Reports source files over the code-line limit of their language.

@param session the repository and its tools.
@param planned the scope files and limits.
*/
export async function checkStructureLongFiles(session: Session, planned: PlannedCheck): Promise<CheckFinding[]> {
    const sources = listCheckedFiles(session.scopes, planned).flatMap((file) => {
        const tagged: GrammarName | 'sql' | undefined = file.tags.includes('sql')
            ? 'sql'
            : GRAMMAR_NAMES.find((name) => file.tags.includes(name));
        const language: GrammarName | 'sql' | undefined =
            file.tags.includes('shell') || file.tags.includes('bash') ? 'bash' : tagged;
        if (language === undefined) return [];
        return [{ file, language, limit: getLimit(planned.scope.settings, 'file_lines', language) }];
    });
    const findings = await Promise.all(
        sources.map(async ({ file, language, limit }) => {
            const text = readCachedText(session.reads, file.path);
            const count = await countCodeLines(text, language);
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
