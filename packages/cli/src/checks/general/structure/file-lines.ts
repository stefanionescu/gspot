import { findingAt } from '#cli/checks/finding.ts';
import { extensionOf } from '#cli/platform/contracts.ts';
import { readSource } from '#cli/platform/root/public.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import { parseComments } from '#cli/parsers/source/public.ts';
import type { CheckInput } from '#cli/types/execution/check.ts';
import { COMMENT_STYLE_BY_EXTENSION } from '#cli/config/checks/general/structure.ts';

/**
 * Report source files above their language's code-line ceiling.
 * @param input the selected files and effective scope settings
 * @returns each file above its ceiling
 */
export async function fileLines(input: CheckInput): Promise<Finding[]> {
    const sources = input.files.flatMap((file) => {
        const style =
            COMMENT_STYLE_BY_EXTENSION[extensionOf(file.path)] ??
            (file.tags.includes('shebang:shell') ? COMMENT_STYLE_BY_EXTENSION[''] : undefined);
        const ceiling = style === undefined ? undefined : input.view.limit('file_lines', style[0]);
        return style === undefined || ceiling === undefined || file.kind !== 'source' ? [] : [{ file, style, ceiling }];
    });
    const findings = await Promise.all(
        sources.map(async ({ file, style, ceiling }) => {
            const text = readSource(input.root, file.path, input.reads).toString('utf8');
            const parsed = style[0] === 'bash' ? await parseComments(`${file.path}.sh`, text) : undefined;
            const comments = new Set(parsed?.filter((comment) => comment.standalone).map((comment) => comment.line));
            const count = text
                .split('\n')
                .filter(
                    (line, index) =>
                        line.trim() !== '' &&
                        (parsed === undefined ? !line.trimStart().startsWith(style[1]) : !comments.has(index + 1)),
                ).length;
            return count <= ceiling
                ? []
                : [
                      findingAt(
                          input,
                          { file: file.path, line: 1 },
                          'file-lines',
                          `This file has ${String(count)} code lines, over the ceiling of ${String(ceiling)}.`,
                      ),
                  ];
        }),
    );
    return findings.flat();
}
