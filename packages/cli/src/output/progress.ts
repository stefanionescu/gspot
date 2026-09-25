import type { CheckResult } from '#cli/checks/result.ts';

/**
 * Print completed check states without mixing progress into machine-readable output.
 * @param stream
 * @param stream.isTTY
 * @param stream.write
 * @param quiet
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
