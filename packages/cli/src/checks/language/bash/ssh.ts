import { findingAt } from '#cli/execution/finding.ts';
import type { Engine } from '#cli/types/execution/runtime.ts';
import { functionAt, getScriptIndex } from '#cli/checks/language/bash/scripts.ts';
import { SSH_HEREDOC, SSH_BLOCK_LINES } from '#cli/config/checks/language/bash.ts';

/**
 * One finding per multi-line block a remote function runs outside a named function, and per ssh heredoc without a named
 * comment above it.
 * @param input the check context
 * @returns the findings
 */
export const sshBlocks: Engine = async (input) => {
    const remoteFunctions = new Set(input.view.settings['bash.remote_functions'] as string[]);
    const index = await getScriptIndex(input);
    return index.files.flatMap((file) => {
        const quoted = file.quotedArguments
            .filter(
                (block) =>
                    remoteFunctions.has(block.command) &&
                    block.end - block.start + 1 >= SSH_BLOCK_LINES &&
                    functionAt(file.functions, block.start) === undefined,
            )
            .map((block) =>
                findingAt(
                    input,
                    { file: file.path, line: block.start },
                    'unnamed-block',
                    `A ${String(block.end - block.start + 1)}-line remote block sits outside a named function.`,
                ),
            );
        const heredocs = file.code.flatMap((line, position) => {
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
        return [...quoted, ...heredocs];
    });
};
