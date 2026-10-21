import { buildFinding } from '#cli/runs/finding.ts';
import { getLimit } from '#cli/settings/scope-view.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import { readCachedText } from '#cli/system/files/reads.ts';
import { parseGrammarComments } from '#cli/parsers/comments.ts';
import { COMMENT_MARKERS } from '#cli/config/checks/structure.ts';
import type { Session, PlannedCheck } from '#cli/types/planning.ts';

/**
 * Reports source files over the code-line limit of their language.
 *
 * @param session the repository and its tools.
 * @param planned the scope files and limits.
 * @returns one finding per long file.
 */
export async function checkLongFiles(session: Session, planned: PlannedCheck): Promise<Finding[]> {
    const sources = planned.files.flatMap((file) => {
        const comment: [string, string] | undefined = file.tags.includes('shell')
            ? ['bash', COMMENT_MARKERS.bash]
            : Object.entries(COMMENT_MARKERS).find(([name]) => file.tags.includes(name));
        if (comment === undefined) return [];
        const [language, marker] = comment;
        return [{ file, language, marker, limit: getLimit(planned.selection.view, 'file_lines', language) }];
    });
    const findings = await Promise.all(
        sources.map(async ({ file, language, marker, limit }) => {
            const text = readCachedText(session.reads, file.path);
            const parsed = language === 'bash' ? await parseGrammarComments('bash', text) : undefined;
            const comments = new Set(parsed?.filter((comment) => comment.standalone).map((comment) => comment.line));
            const count = text
                .split('\n')
                .filter(
                    (line, index) =>
                        line.trim() !== '' &&
                        (parsed === undefined ? !line.trimStart().startsWith(marker) : !comments.has(index + 1)),
                ).length;
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
