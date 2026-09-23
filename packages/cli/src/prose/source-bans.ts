import { readSource } from '#cli/repository/tracked.ts';
// What a source file may not say to Vale: an in-text directive in Markdown, a block comment in SQL.
import type { EngineInput } from '#cli/run/types.ts';
import type { Finding } from '#cli/output/finding.ts';
import { extensionOf } from '#cli/platform/paths.ts';
import { CODE_SPAN, SQL_BLOCK_COMMENT, VALE_DIRECTIVE } from '#cli/prose/prose-definitions.ts';

const MARKDOWN = new Set(['.md', '.mdx']);
const SQL = new Set(['.sql', '.pgsql', '.psql']);

function lineFindings(input: EngineInput, path: string, lines: string[]): Finding[] {
    const extension = extensionOf(path);
    return lines.flatMap((line, index) => {
        if (MARKDOWN.has(extension) && VALE_DIRECTIVE.test(line.replaceAll(CODE_SPAN, '')))
            return [
                {
                    check: input.spec.name,
                    file: path,
                    line: index + 1,
                    rule: 'vale-directive',
                    message:
                        'A Vale directive turns a rule off in the text; change the text or record an exception with gspot ignore prose/vale --rule <rule>.',
                    fixable: false,
                },
            ];
        if (SQL.has(extension) && line.includes(SQL_BLOCK_COMMENT))
            return [
                {
                    check: input.spec.name,
                    file: path,
                    line: index + 1,
                    rule: 'block-comment',
                    message: 'SQL comments are -- lines, which Vale reads; a /* */ block is invisible to it.',
                    fixable: false,
                },
            ];
        return [];
    });
}

/**
 * One finding per banned form in the scope's Markdown and SQL files.
 * @param input the engine input
 * @returns the findings
 */
export function sourceBans(input: EngineInput): Finding[] {
    const findings = input.files
        .filter(
            (file) =>
                file.nature === 'source' && (MARKDOWN.has(extensionOf(file.path)) || SQL.has(extensionOf(file.path))),
        )
        .flatMap((file) =>
            lineFindings(input, file.path, readSource(input.root, file.path).toString('utf8').split('\n')),
        );
    return findings;
}
