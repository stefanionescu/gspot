import { buildFinding } from '#cli/runs/finding.ts';
import { readCachedBytes } from '#cli/system/files/reads.ts';
import { parseGrammarComments } from '#cli/parsers/comments.ts';
import { COMMENT_MARKERS } from '#cli/config/checks/structure.ts';
import type { Finding, CheckInput } from '#cli/types/runs/check.ts';

/**
 * Reports source files over the code-line limit of their language.
 * @param input the scope files and limits.
 * @returns one finding per long file.
 */
export async function checkLongFiles(input: CheckInput): Promise<Finding[]> {
    const sources = input.files.flatMap((file) => {
        const language = file.tags.includes('shell')
            ? 'bash'
            : file.tags.find((tag) => Object.hasOwn(COMMENT_MARKERS, tag));
        return language === undefined
            ? []
            : [{ file, language, limit: input.selection.view.limit('file_lines', language) }];
    });
    const findings = await Promise.all(
        sources.map(async ({ file, language, limit }) => {
            const text = readCachedBytes(input.reads, file.path).toString('utf8');
            const parsed = language === 'bash' ? await parseGrammarComments('bash', text) : undefined;
            const comments = new Set(parsed?.filter((comment) => comment.standalone).map((comment) => comment.line));
            const count = text
                .split('\n')
                .filter(
                    (line, index) =>
                        line.trim() !== '' &&
                        (parsed === undefined
                            ? !line
                                  .trimStart()
                                  .startsWith((COMMENT_MARKERS as Readonly<Record<string, string>>)[language] as string)
                            : !comments.has(index + 1)),
                ).length;
            return count <= limit
                ? []
                : [
                      buildFinding(
                          input,
                          { file: file.path, line: 1 },
                          'file-lines',
                          `This file has ${String(count)} code lines, over the limit of ${String(limit)}.`,
                      ),
                  ];
        }),
    );
    return findings.flat();
}
