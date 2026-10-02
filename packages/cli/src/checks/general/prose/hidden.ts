import { extensionOf } from '#cli/platform/paths.ts';
import { findingAt } from '#cli/execution/finding.ts';
import { readSource } from '#cli/repository/sources.ts';
import type { Finding, EngineInput } from '#cli/types/execution/execution.ts';
import { SQL, MARKDOWN, CODE_SPAN, VALE_DIRECTIVE, SQL_BLOCK_COMMENT } from '#cli/config/checks/general/prose.ts';

function lineFindings(input: EngineInput, path: string, lines: string[]): Finding[] {
    const extension = extensionOf(path);
    return lines.flatMap((line, index) => {
        if (MARKDOWN.has(extension) && VALE_DIRECTIVE.test(line.replaceAll(CODE_SPAN, '')))
            return [
                findingAt(
                    input,
                    { file: path, line: index + 1 },
                    'vale-directive',
                    'A Vale directive turns a rule off in the text; change the text or record an exception with gspot ignore prose/vale --rule <rule>.',
                ),
            ];
        if (SQL.has(extension) && line.includes(SQL_BLOCK_COMMENT))
            return [
                findingAt(
                    input,
                    { file: path, line: index + 1 },
                    'block-comment',
                    'SQL comments are -- lines, which Vale reads; a /* */ block is invisible to it.',
                ),
            ];
        return [];
    });
}

/**
 * One finding per banned form in the scope's Markdown and SQL files.
 * @param input the engine input
 * @returns the findings
 */
export function banned(input: EngineInput): Finding[] {
    return input.files
        .filter(
            (file) =>
                file.kind === 'source' && (MARKDOWN.has(extensionOf(file.path)) || SQL.has(extensionOf(file.path))),
        )
        .flatMap((file) =>
            lineFindings(input, file.path, readSource(input.root, file.path, input.reads).toString('utf8').split('\n')),
        );
}
