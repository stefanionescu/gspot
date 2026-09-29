import { HOOK_FILES } from '#cli/config/repository/repository.ts';
import { hookPrefix, hookCommand, commitPathLines } from '#cli/generation/hooks/scripts.ts';
/**
 * The managed invocation in each authored Husky script.
 * @param root the repository root.
 * @param runner the task runner the policy names, or undefined.
 * @param binaryPath the pinned executable when no runner resolves gspot.
 * @returns the Husky script path and the one line gspot owns in it, per hook.
 */
export function huskyLines(
    root: string,
    runner: string | undefined,
    binaryPath?: string,
): { path: string; line: string }[] {
    const prefix = hookPrefix(root);
    return HOOK_FILES.map((name) => ({
        path: `.husky/${name}`,
        line: [
            '(gspot_status=0',
            'cd "${GSPOT_HOOK_ROOT:-$(git rev-parse --show-toplevel)}" || exit 2',
            ...(name === 'pre-push'
                ? ['set -- "${GSPOT_HOOK_REMOTE_NAME-$1}" "${GSPOT_HOOK_REMOTE_LOCATION-$2}"']
                : []),
            ...(name === 'commit-msg'
                ? ['gspot_message=${GSPOT_HOOK_MESSAGE-$1}', ...commitPathLines('gspot_message', true)]
                : []),
            `(${hookCommand(name, runner, binaryPath, prefix)})${name === 'pre-push' ? ' < "${GSPOT_HOOK_INPUT:-/dev/stdin}"' : ''} || gspot_status=$?`,
            'if [ -n "${GSPOT_HOOK_RESULT:-}" ]; then echo "$gspot_status" > "$GSPOT_HOOK_RESULT"; fi',
            'exit "$gspot_status")',
        ].join('; '),
    }));
}
