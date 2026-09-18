// What a source file may not say to Vale: an in-text directive in Markdown, a block comment in SQL.
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import type { EngineInput } from '#types/run.ts';
import type { Finding } from '#types/finding.ts';
import { extensionOf } from '#cli/platform/paths.ts';
import { CODE_SPAN, SQL_BLOCK_COMMENT, VALE_DIRECTIVE } from '#config/prose.ts';

const MARKDOWN = new Set(['.md', '.mdx']);
const SQL = new Set(['.sql', '.pgsql', '.psql']);

function lineFindings(input: EngineInput, path: string, lines: string[]): Finding[] {
    const extension = extensionOf(path);
    return lines.flatMap((line, index) => {
        if (MARKDOWN.has(extension) && VALE_DIRECTIVE.test(line.replaceAll(CODE_SPAN, '')))
            return [
                {
                    check: input.spec.id,
                    file: path,
                    line: index + 1,
                    rule: 'vale-directive',
                    message:
                        'A Vale directive turns a rule off in the text; change the text or disable the rule with a reason under prose.disabled.',
                    fixable: false,
                },
            ];
        if (SQL.has(extension) && line.includes(SQL_BLOCK_COMMENT))
            return [
                {
                    check: input.spec.id,
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
export function sourceBans(input: EngineInput): Promise<Finding[]> {
    const findings = input.files
        .filter(
            (file) =>
                file.nature === 'source' && (MARKDOWN.has(extensionOf(file.path)) || SQL.has(extensionOf(file.path))),
        )
        .flatMap((file) =>
            lineFindings(input, file.path, readFileSync(join(input.root, file.path), 'utf8').split('\n')),
        );
    return Promise.resolve(findings);
}
