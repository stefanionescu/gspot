import { spyOn } from 'bun:test';
import type { TerminalCapture } from '#tests/types/processes.ts';

/**
Capture both terminal streams until the caller disposes the capture, restoring the original writers together.
*/
export function captureTerminal(): TerminalCapture {
    const output: Pick<TerminalCapture, 'stdout' | 'stderr'> = { stdout: [], stderr: [] };
    const resources = new DisposableStack();
    for (const stream of ['stdout', 'stderr'] as const)
        resources.use(
            spyOn(process[stream], 'write').mockImplementation((chunk: string | Uint8Array) => {
                output[stream].push(Buffer.from(chunk).toString());
                return true;
            }),
        );
    return Object.assign(resources, output);
}
