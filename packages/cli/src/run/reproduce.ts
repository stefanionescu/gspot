import type { CheckOptions } from '#cli/commands/check.ts';
// The reproduce line per failing check: the same in the hook, in CI and in the terminal.

import { quoteArgument } from '#cli/platform/arguments.ts';

/**
 * The command that runs one check alone.
 * @param checkName the check name
 * @param scope the scope path, '' for the root
 * @param options the stage, message file, or exact push input
 * @returns the command line
 */
export function reproduceLine(
    checkName: string,
    scope: string,
    options: Pick<CheckOptions, 'stage' | 'push' | 'messageFile'> = {},
): string {
    const { stage, push, messageFile } = options;
    if (push !== undefined) {
        const remote = push.remote === undefined ? '' : ` -- ${quoteArgument(push.remote)} ''`;
        return `printf '%s' ${quoteArgument(push.input)} | gspot check --push --only ${quoteArgument(checkName)}${remote}`;
    }
    const parts = ['gspot check'];
    if (scope !== '') parts.push(quoteArgument(scope));
    parts.push('--only', quoteArgument(checkName));
    if (stage !== undefined && stage !== 'commit' && stage !== 'push') parts.push('--stage', stage);
    if (messageFile !== undefined) parts.push('--message-file', quoteArgument(messageFile));
    return parts.join(' ');
}
