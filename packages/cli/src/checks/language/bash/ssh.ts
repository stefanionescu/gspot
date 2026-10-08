import { findingAt } from '#cli/checks/finding.ts';
import type { BuiltInCheck } from '#cli/types/execution/check.ts';
import { SSH_HEREDOC } from '#cli/config/checks/language/bash.ts';
import { getScriptIndex } from '#cli/checks/language/contracts.ts';

/**
 * One finding per ssh heredoc without a named comment above it.
 * @param input the check context
 * @returns the findings
 */
export const sshBlocks: BuiltInCheck = async (input) => {
    const index = await getScriptIndex(input);
    return index.files.flatMap((file) => {
        return file.code.flatMap((line, position) => {
            if (!SSH_HEREDOC.test(line)) return [];
            const previous = (file.lines[position - 1] ?? '').trim();
            if (/^# [A-Za-z_]\w*:\s+\S/u.test(previous)) return [];
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
};
