// The reproduce line per failing check: the same in the hook, in CI and in the terminal.

/** The command that runs one check alone. */
export function reproduceLine(id: string, scope: string, stage?: string): string {
    const parts = ['gspot check', id];
    if (scope !== '') parts.push('--scope', scope);
    if (stage !== undefined && stage !== 'commit' && stage !== 'push') parts.push('--stage', stage);
    return parts.join(' ');
}
