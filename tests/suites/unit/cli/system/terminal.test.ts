import { test, expect } from 'bun:test';
import { runCancelableCommand } from '#cli/system/terminal.ts';

test('an aborted command returns its cancellation status and removes its signal listeners', async () => {
    const listeners = process.listenerCount('SIGINT');
    const result = await runCancelableCommand((signal) => {
        process.emit('SIGINT');
        expect(signal.aborted).toBe(true);
        return Promise.reject(new Error('The command stopped.'));
    }, 'The command was canceled.');
    expect(result).toStrictEqual({
        exitCode: 130,
        text: 'The command was canceled.\n',
        json: { error: 'canceled', message: 'The command was canceled.', exitCode: 130 },
    });
    expect(process.listenerCount('SIGINT')).toBe(listeners);
});
