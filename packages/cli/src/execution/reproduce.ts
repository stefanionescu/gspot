// Reproduce one check with the same stage, scope, message, or pushed revision.
import { quoteArgument } from '#cli/platform/text.ts';
import type { ReproduceOptions } from '#cli/types/execution/reproduce.ts';

/**
 * The command that runs one check alone.
 * @param checkName the check ID.
 * @param scope the scope path, '' for the root.
 * @param options the message file or the exact push input.
 * @param options.push the pre-push input the check read.
 * @param options.push.stdin the lines Git handed the hook.
 * @param options.push.remote the remote name, when Git gave one.
 * @param options.messageFile the commit message file, which selects the message checks.
 * @param options.staged whether the finding used staged content.
 * @returns the command line.
 */
export function reproduceLine(checkName: string, scope: string, options: ReproduceOptions): string {
    const { push, messageFile: commitFile, staged } = options;
    if (push !== undefined) {
        const remote = push.remote === undefined ? '' : ` -- ${quoteArgument(push.remote)} ''`;
        return `printf '%s' ${quoteArgument(push.stdin)} | gspot check --hook pre-push --only ${quoteArgument(checkName)}${remote}`;
    }
    const parts = ['gspot check'];
    if (scope !== '') parts.push(quoteArgument(scope));
    parts.push('--only', quoteArgument(checkName));
    if (commitFile !== undefined) parts.push('--message-file', quoteArgument(commitFile));
    if (staged === true) parts.push('--staged');
    return parts.join(' ');
}
