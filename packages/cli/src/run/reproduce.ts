import type { CheckOptions } from '#types/run.ts';

function quoted(value: string): string {
    if (/^[a-zA-Z0-9_./-]+$/u.test(value)) return value;
    return `'${value.replaceAll("'", "'\"'\"'")}'`;
}

// The reproduce line per failing check: the same in the hook, in CI and in the terminal.

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
        const remote = push.remote === undefined ? '' : ` -- ${quoted(push.remote)} ''`;
        return `printf '%s' ${quoted(push.input)} | gspot check --push --only ${quoted(checkName)}${remote}`;
    }
    const parts = ['gspot check'];
    if (scope !== '') parts.push(quoted(scope));
    parts.push('--only', quoted(checkName));
    if (stage !== undefined && stage !== 'commit' && stage !== 'push') parts.push('--stage', stage);
    if (messageFile !== undefined) parts.push('--message-file', quoted(messageFile));
    return parts.join(' ');
}
