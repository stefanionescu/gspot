import { quoteArgument } from '#cli/platform/quoting.ts';

/**
 * The command that runs one check alone.
 * @param checkName the check name.
 * @param scope the scope path, '' for the root.
 * @param options the message file or the exact push input.
 * @param options.push the pre-push input the check read.
 * @param options.push.input the lines Git handed the hook.
 * @param options.push.remote the remote name, when Git gave one.
 * @param options.messageFile the commit message file, which selects the message checks.
 * @returns the command line.
 */
export function reproduceLine(
    checkName: string,
    scope: string,
    options: { push?: { input: string; remote?: string }; messageFile?: string } = {},
): string {
    const { push, messageFile: commitFile } = options;
    if (push !== undefined) {
        const remote = push.remote === undefined ? '' : ` -- ${quoteArgument(push.remote)} ''`;
        return `printf '%s' ${quoteArgument(push.input)} | gspot check --push --only ${quoteArgument(checkName)}${remote}`;
    }
    const parts = ['gspot check'];
    if (scope !== '') parts.push(quoteArgument(scope));
    parts.push('--only', quoteArgument(checkName));
    if (commitFile !== undefined) parts.push('--message-file', quoteArgument(commitFile));
    return parts.join(' ');
}
