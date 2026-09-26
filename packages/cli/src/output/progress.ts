import type { CheckResult } from '#cli/checks/result.ts';

/**
 * Print completed check states without mixing progress into machine-readable output.
 * @param stream the stream progress goes to
 * @param stream.isTTY whether a person is watching it
 * @param stream.write writes one line
 * @param quiet whether progress stays off
 * @returns the function each completed check is handed to
 */
export function progress(
    stream: { isTTY?: boolean; write(text: string): unknown },
    quiet: boolean,
): (result: CheckResult) => void {
    return (result) => {
        const failed = result.status === 'fail' || result.status === 'missing' || result.status === 'error';
        if (!failed && (quiet || stream.isTTY !== true)) return;
        const status = result.status === 'cache' ? 'unchanged' : result.status;
        stream.write(`${result.scope === '' ? 'root' : result.scope}  ${result.check}  ${status}\n`);
    };
}
