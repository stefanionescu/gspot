import { findingAt } from '#cli/checks/finding.ts';
import { readScripts } from '#cli/checks/language/bash/scripts.ts';
import type { Finding, CheckInput } from '#cli/types/execution/check.ts';
import { SSH_HEREDOC, NAMED_COMMENT } from '#cli/config/checks/language/bash.ts';

/**
 * One finding per ssh heredoc without a named comment above it.
 * @param input the check context.
 * @returns the findings.
 */
export async function bashSshBlocks(input: CheckInput): Promise<Finding[]> {
    const index = await readScripts(input);
    return index.flatMap((file) => {
        return file.code.flatMap((line, position) => {
            if (!SSH_HEREDOC.test(line)) return [];
            const previous = (file.lines[position - 1] ?? '').trim();
            if (NAMED_COMMENT.test(previous)) return [];
            return [
                findingAt(
                    input,
                    { file: file.path, line: position + 1 },
                    'undocumented-block',
                    'An ssh heredoc carries a "# name: what it does" line above it.',
                ),
            ];
        });
    });
}
