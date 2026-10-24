import { test, expect } from 'bun:test';
import { parseMiseTasks } from '#cli/parsers/projects/mise.ts';

test('mise validates a task alias through the file schema', () => {
    expect(() => parseMiseTasks('[tasks.build]\nalias = 5\nrun = "echo"\n', 'mise.toml')).toThrow(
        expect.objectContaining({
            name: 'GspotError',
            code: 'filesystem',
            message:
                'mise.toml: tasks.build: Invalid input; tasks.build: Invalid input: expected string, received object; tasks.build: Invalid input: expected array, received object; tasks.build.alias: Invalid input; tasks.build.alias: Invalid input: expected string, received number; tasks.build.alias: Invalid input: expected array, received number. Fix the field.',
        }),
    );
});

test('mise keeps string tasks, command lists, and task-table aliases', () => {
    expect(
        parseMiseTasks(
            'tasks.build = "echo"\ntasks.test = ["echo test"]\n[tasks.check]\nalias = ["lint", "verify"]\nrun = "echo check"\n',
            'mise.toml',
        ),
    ).toStrictEqual(['build', 'test', 'check', 'lint', 'verify']);
});
