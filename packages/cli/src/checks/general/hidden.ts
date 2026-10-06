import { extensionOf } from '#cli/platform/paths.ts';
import { readSource } from '#cli/platform/source.ts';
import { findingAt } from '#cli/execution/finding.ts';
import { extensionsTagged } from '#cli/repository/tags.ts';
import { BLOCK_COMMENT } from '#cli/config/checks/language/sql.ts';
import type { Finding, EngineInput } from '#cli/types/execution/runtime.ts';
import { CODE_SPAN, VALE_DIRECTIVE } from '#cli/config/checks/general/prose.ts';

function lineFindings(input: EngineInput, path: string, lines: string[]): Finding[] {
    const extension = extensionOf(path);
    const markdown = extensionsTagged('markdown');
    const sql = extensionsTagged('sql');
    return lines.flatMap((line, index) => {
        if (markdown.includes(extension) && VALE_DIRECTIVE.test(line.replaceAll(CODE_SPAN, '')))
            return [
                findingAt(
                    input,
                    { file: path, line: index + 1 },
                    'vale-directive',
                    'A Vale directive turns a rule off in the text; change the text or record an exception with gspot ignore prose/vale --rule <rule>.',
                ),
            ];
        if (sql.includes(extension) && line.includes(BLOCK_COMMENT))
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
export function hiddenProse(input: EngineInput): Finding[] {
    const extensions = new Set(extensionsTagged('markdown', 'sql'));
    return input.files
        .filter((file) => file.kind === 'source' && extensions.has(extensionOf(file.path)))
        .flatMap((file) =>
            lineFindings(input, file.path, readSource(input.root, file.path, input.reads).toString('utf8').split('\n')),
        );
}
