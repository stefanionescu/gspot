import { openConfinedRoot } from '#cli/platform/filesystem.ts';
import { HOOK_FILES } from '#cli/constants/repository/repository.ts';
import { hookPrefix, runnerExec } from '#cli/generation/hooks/scripts.ts';
import type { ConfigurationOutput, HookName } from '#cli/types/generation.ts';
/**
 * Preserve the gspot verdict before the native manager combines job results.
 * @param name the hook
 * @param runner the task runner the policy names, or undefined
 * @param binaryPath the pinned executable when no runner resolves gspot
 * @returns the Lefthook command text
 */
export function lefthookCommand(name: HookName, runner: string | undefined, binaryPath?: string): string {
    let args = 'check --staged';
    if (name === 'pre-push')
        args =
            'check --push -- "${GSPOT_LEFTHOOK_REMOTE_NAME:?Run gspot install, then use the Git hook}" "${GSPOT_LEFTHOOK_REMOTE_LOCATION:?Run gspot install, then use the Git hook}"';
    else if (name === 'commit-msg')
        args =
            'check --stage message --message-file "${GSPOT_LEFTHOOK_MESSAGE:?Run gspot install, then use the Git hook}"';
    return [
        'gspot_status=0',
        `${runnerExec(runner, binaryPath)} ${args} || gspot_status=$?`,
        String.raw`if [ "$gspot_status" -eq 126 ] || [ "$gspot_status" -eq 127 ]; then printf "%s\n" "The pinned gspot executable is unavailable. Install gspot, then run: gspot install" >&2; gspot_status=2; fi`,
        'if [ -n "${GSPOT_LEFTHOOK_RESULT:-}" ]; then printf "%s\\n" "$gspot_status" > "$GSPOT_LEFTHOOK_RESULT"; fi',
        'exit "$gspot_status"',
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
    const files = openConfinedRoot(root);
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
