import { test, expect } from 'bun:test';
import { captureThrow } from '#tests/setup/matchers.ts';
import { parseMiseTasks } from '#cli/parsers/projects/mise.ts';

test('mise validates a task alias through the file schema', () => {
    const message = captureThrow(() => parseMiseTasks('[tasks.build]\nalias = 5\nrun = "echo"\n', 'mise.toml'));
    expect(message).toStartWith('mise.toml: tasks.build: ');
    expect(message).toContain('tasks.build.alias: Invalid input: expected string, received number');
    expect(message).toEndWith('Fix the field.');
});

test('mise keeps string tasks, command lists, and task-table aliases', () => {
    expect(
        parseMiseTasks(
            'tasks.build = "echo"\ntasks.test = ["echo test"]\n[tasks.check]\nalias = ["lint", "verify"]\nrun = "echo check"\n',
            'mise.toml',
        ),
    ).toStrictEqual(['build', 'test', 'check', 'lint', 'verify']);
});
