import { test } from 'bun:test';
import { LATER_TEST_MESSAGE } from '#tests/config/setup/programs.ts';

test('interrupts', async () => {
    process.kill(process.pid, 'SIGINT');
    await new Promise(() => {});
});

test('never starts', () => {
    throw new Error(LATER_TEST_MESSAGE);
});
