import { openRoot } from '#cli/platform/filesystem.ts';
import { hookPrefix } from '#cli/generation/hooks/scripts.ts';
import { HOOK_FILES } from '#cli/config/repository/repository.ts';
import { RUNNER_EXEC, LEFTHOOK_ARGUMENTS } from '#cli/config/generation.ts';
import type { HookName, ConfigurationOutput } from '#cli/types/generation.ts';
/**
 * Preserve the gspot verdict before the native manager combines job results.
 * @param name the hook
 * @param runner the task runner the policy names, or undefined
 * @param binaryPath the pinned executable when no runner resolves gspot
 * @returns the Lefthook command text
 */
export function lefthookCommand(name: HookName, runner: string | undefined, binaryPath?: string): string {
    // On Windows, Lefthook wraps this text in a double-quoted sh command line without escaping it, so the text holds
    // no double quote. An empty IFS keeps every unquoted expansion one word, and case replaces the empty-value tests.
    // Lefthook reads braces as its own templates, so the variables stand without them.
    const { args, required } = LEFTHOOK_ARGUMENTS[name];
    // A single quote in the path closes, escapes, and reopens the quoting: '\''.
    const quoted = binaryPath?.replaceAll("'", String.raw`'\''`);
    const executable = RUNNER_EXEC[runner ?? ''] ?? (quoted === undefined ? 'gspot' : `'${quoted}'`);
    return [
        'IFS=',
        'set -f',
        ...required.map(
            (variable) =>
                `case $${variable} in '') echo 'Run gspot install, then use the Git hook' >&2; exit 2 ;; esac`,
        ),
        'gspot_status=0',
        `${executable} ${args} || gspot_status=$?`,
        "case $gspot_status in 126 | 127) echo 'The pinned gspot executable is unavailable. Install gspot, then run: gspot install' >&2; gspot_status=2 ;; esac",
        'case $GSPOT_HOOK_RESULT in ?*) echo $gspot_status > $GSPOT_HOOK_RESULT ;; esac',
        'exit $gspot_status',
    ].join('; ');
}

/**
 * Select the authored Lefthook file and own only the gspot commands.
 * @param root the repository root
 * @param runner the task runner the policy names, or undefined
 * @param binary the pinned executable when no runner resolves gspot
 * @returns the shared configuration output with the keys gspot installs
 */
export function lefthookConfiguration(
    root: string,
    runner: string | undefined,
    binary: string | undefined,
): ConfigurationOutput {
    if (hookPrefix(root) !== '')
        throw new Error('Lefthook reads configuration at the Git root. Configure its integration from that directory.');
    const files = openRoot(root);
    let path: string;
    try {
        path = ['lefthook.yml', '.lefthook.yml'].find((name) => files.read(name) !== undefined) ?? 'lefthook.yml';
    } finally {
        files.close();
    }
    return {
        path,
        format: 'yaml',
        changes: [
            { path: ['no_auto_install'], value: true },
            ...HOOK_FILES.map((name) => ({
                path: [name, 'commands', 'gspot'],
                value: {
                    run: lefthookCommand(name, runner, binary),
                    ...(name === 'pre-push' ? { use_stdin: true } : {}),
                },
            })),
        ],
    };
}
