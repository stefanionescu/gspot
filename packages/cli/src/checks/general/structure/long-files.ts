import { getLimit } from '#cli/settings/scopes.ts';
import type { Session } from '#cli/types/session.ts';
import { buildFinding } from '#cli/checks/finding.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import { countCodeLines } from '#cli/checks/code-lines.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { readCachedText } from '#cli/system/files/reads.ts';
import { COMMENT_MARKERS } from '#cli/config/checks/code-lines.ts';
import { parseGrammarComments } from '#cli/parsers/code/comments.ts';

/**
Reports source files over the code-line limit of their language.

@param session the repository and its tools.
@param planned the scope files and limits.
@returns one finding per long file.
*/
export async function checkStructureLongFiles(session: Session, planned: PlannedCheck): Promise<Finding[]> {
    const sources = planned.files.flatMap((file) => {
        const comment: [string, string] | undefined = file.tags.includes('shell')
            ? ['bash', COMMENT_MARKERS.bash]
            : Object.entries(COMMENT_MARKERS).find(([name]) => file.tags.includes(name));
        if (comment === undefined) return [];
        const [language, marker] = comment;
        return [{ file, language, marker, limit: getLimit(planned.scope.settings, 'file_lines', language) }];
    });
    const findings = await Promise.all(
        sources.map(async ({ file, language, marker, limit }) => {
            const text = readCachedText(session.reads, file.path);
            const parsed = language === 'bash' ? await parseGrammarComments('bash', text) : undefined;
            const comments = new Set(parsed?.filter((comment) => comment.standalone).map((comment) => comment.line));
            const lines = text.split('\n');
            const count =
                parsed === undefined
                    ? countCodeLines(lines, marker)
                    : lines.filter((line, index) => line.trim() !== '' && !comments.has(index + 1)).length;
            return count <= limit
                ? []
                : [
                      buildFinding(
                          planned,
                          { file: file.path, line: 1 },
                          'file-lines',
                          `This file has ${String(count)} code lines, over the limit of ${String(limit)}.`,
                      ),
                  ];
        }),
    );
    return findings.flat();
}
