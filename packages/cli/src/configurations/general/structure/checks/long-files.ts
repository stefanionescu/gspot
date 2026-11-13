import { FILE_LINES_RULE } from '#cli/config/configurations/structure.ts';
import { GRAMMAR_NAMES } from '#cli/config/parsers/code.ts';
import { listCheckedFiles } from '#cli/engine/plan/files.ts';
import { countCodeLines } from '#cli/parsers/code/comments.ts';
import { getLimit } from '#cli/settings/tables.ts';
import { readText } from '#cli/system/files/reads.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { CheckCode, CheckFinding } from '#cli/types/engine/run.ts';
import type { GrammarName } from '#cli/types/parsers.ts';
import type { Session } from '#cli/types/tools.ts';

async function checkLongFiles(session: Session, planned: PlannedCheck): Promise<CheckFinding[]> {
    const sources = listCheckedFiles(session.scopes, planned).flatMap((file) => {
        const tagged: GrammarName | 'sql' | undefined = file.tags.includes('sql')
            ? 'sql'
            : GRAMMAR_NAMES.find((name) => file.tags.includes(name));
        const language: GrammarName | 'sql' | undefined =
            file.tags.includes('shell') || file.tags.includes('bash') ? 'bash' : tagged;
        return language === undefined
            ? []
            : [{ file, language, limit: getLimit(planned.scope.settings, 'max_file_lines', language) }];
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

export const STRUCTURE_LONG_FILES_CHECKS: Readonly<Record<string, CheckCode>> = {
    'structure/long-files': { check: checkLongFiles },
};
