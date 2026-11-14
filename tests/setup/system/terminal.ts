import { spyOn } from 'bun:test';
import type { TerminalCapture } from '#tests/types/setup.ts';

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

export function fakeTerminals(
    terminals: ReadonlyArray<readonly [NodeJS.ReadStream | NodeJS.WriteStream, boolean]>,
): Disposable {
    using resources = new DisposableStack();
    for (const [stream, isTerminal] of terminals) {
        const descriptor = Object.getOwnPropertyDescriptor(stream, 'isTTY');
        resources.defer(() => {
            if (descriptor === undefined) Reflect.deleteProperty(stream, 'isTTY');
            else Object.defineProperty(stream, 'isTTY', descriptor);
        });
        Object.defineProperty(stream, 'isTTY', { value: isTerminal, configurable: true });
    }
    return resources.move();
}
