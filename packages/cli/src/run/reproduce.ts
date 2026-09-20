// The reproduce line per failing check: the same in the hook, in CI and in the terminal.

/**
 * The command that runs one check alone.
 * @param checkName the check name
 * @param scope the scope path, '' for the root
 * @param stage the stage, when it is not commit or push
 * @returns the command line
 */
export function reproduceLine(checkName: string, scope: string, stage?: string): string {
    const parts = ['gspot check'];
    if (scope !== '') parts.push(scope);
    parts.push('--only', checkName);
    if (stage !== undefined && stage !== 'commit' && stage !== 'push') parts.push('--stage', stage);
    return parts.join(' ');
}
