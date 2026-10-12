// Builds the test init arguments and template settings.
import type { InitOptions } from '#cli/types/commands/init.ts';

/** Select the configurations used by an unattended test initialization. */
export function buildInitArguments(configurations: readonly string[], options: { json?: boolean } = {}): string[] {
    return [
        'init',
        '--yes',
        ...(configurations.length === 0 ? [] : ['--configurations', ...configurations]),
        ...(options.json === true ? ['--json'] : []),
    ];
}

/** Supply the required init fields while leaving each test's explicit choices visible. */
export function buildInitOptions(cwd: string, overrides: Partial<InitOptions> = {}): InitOptions {
    return { cwd, yes: true, isDryRun: false, ...overrides };
}
