import { test, expect } from 'bun:test';
import { captureRejection } from '#tests/setup/matchers.ts';
import { parseMiseTasks } from '#cli/parsers/projects/mise.ts';

test('mise validates a task alias through the file schema', async () => {
    const error = await captureRejection(
        Promise.try(() => parseMiseTasks('[tasks.build]\nalias = 5\nrun = "echo"\n', 'mise.toml')),
    );
    expect(error).toMatchObject({ name: 'GspotError', code: 'parse' });
    expect(error.message).toStartWith('mise.toml: tasks.build: ');
    expect(error.message).toEndWith(' Fix the field.');
});

test('mise keeps string tasks, command lists, and task-table aliases', () => {
    expect(
        parseMiseTasks(
            'tasks.build = "echo"\ntasks.test = ["echo test"]\n[tasks.check]\nalias = ["lint", "verify"]\nrun = "echo check"\n',
            'mise.toml',
        ),
    ).toStrictEqual(['build', 'test', 'check', 'lint', 'verify']);
});
