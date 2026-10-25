import { test } from 'bun:test';

test('interrupts', async () => {
    process.kill(process.pid, 'SIGINT');
    await new Promise(() => {});
});

test('never starts', () => {
    throw new Error('Later test ran');
});
