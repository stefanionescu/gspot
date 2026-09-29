// Questions the revision code asks Git, each answered by one command whose failure names the command.
import { run } from '#cli/platform/spawn.ts';
import { GspotError } from '#cli/platform/errors.ts';
import { GIT_TIMEOUT_MS } from '#cli/config/checks/secrets.ts';

/**
 * What a Git command prints, or the selection error it failed with.
 * @param root the repository root
 * @param argv the arguments after git
 * @param cancelSignal cancellation for the command
 * @returns the standard output as printed
 */
export async function gitText(root: string, argv: string[], cancelSignal?: AbortSignal): Promise<string> {
    const result = await run(['git', ...argv], {
        cwd: root,
        timeoutMs: GIT_TIMEOUT_MS,
        ...(cancelSignal === undefined ? {} : { cancelSignal }),
    });
    if (result.code !== 0)
        throw new GspotError('selection', [
            `Git ${argv[0] ?? ''} failed in ${root} (exit ${String(result.code)}): ${result.stderr.trim()}`,
        ]);
    return result.stdout;
}

/**
 * A Git command's output as one value: the text with surrounding whitespace removed.
 * @param root the repository root
 * @param argv the arguments after git
 * @param cancelSignal cancellation for the command
 * @returns the trimmed output
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: A Git command's output as one value: the text with surrounding whitespace removed. 2 files make 6 calls; one owner keeps that behavior in one place.
export async function gitValue(root: string, argv: string[], cancelSignal?: AbortSignal): Promise<string> {
    const text = await gitText(root, argv, cancelSignal);
    return text.trim();
}

/**
 * A Git command's output as its non-empty lines.
 * @param root the repository root
 * @param argv the arguments after git
 * @param cancelSignal cancellation for the command
 * @returns the lines, in order
 */
export async function gitLines(root: string, argv: string[], cancelSignal?: AbortSignal): Promise<string[]> {
    const text = await gitText(root, argv, cancelSignal);
    return text.split('\n').filter((line) => line !== '');
}

/**
 * The paths a NUL-separated Git listing names.
 * @param root the repository root
 * @param argv the arguments after git, which must include -z
 * @param cancelSignal cancellation for the command
 * @returns the paths, in order
 */
export async function gitPaths(root: string, argv: string[], cancelSignal?: AbortSignal): Promise<string[]> {
    const text = await gitText(root, argv, cancelSignal);
    return text.split('\0').filter((path) => path !== '');
}

/**
 * Whether the repository's history is cut by a shallow clone.
 * @param root the repository root
 * @param cancelSignal cancellation for the command
 * @returns true for a shallow repository
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Whether the repository's history is cut by a shallow clone. 2 files make 2 calls; one owner keeps that behavior in one place.
export async function isShallow(root: string, cancelSignal?: AbortSignal): Promise<boolean> {
    const answer = await gitValue(root, ['rev-parse', '--is-shallow-repository'], cancelSignal);
    return answer === 'true';
}
