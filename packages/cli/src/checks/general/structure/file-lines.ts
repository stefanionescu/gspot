import { findingAt } from '#cli/checks/finding.ts';
import { readCachedBytes } from '#cli/system/files/reads.ts';
import { parseGrammarComments } from '#cli/parsers/comments.ts';
import type { Finding, CheckInput } from '#cli/types/execution/check.ts';
import { COMMENT_MARKERS } from '#cli/config/checks/general/structure.ts';

/**
 * Report source files above their language's code-line limit.
 * @param input the selected files and effective scope settings.
 * @returns each file above its limit.
 */
export async function fileLines(input: CheckInput): Promise<Finding[]> {
    const sources = input.files.flatMap((file) => {
        const language = file.tags.includes('shell')
            ? 'bash'
            : file.tags.find((tag) => Object.hasOwn(COMMENT_MARKERS, tag));
        return language === undefined
            ? []
            : [{ file, language, limit: input.scope.view.limit('file_lines', language) }];
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
                      findingAt(
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
