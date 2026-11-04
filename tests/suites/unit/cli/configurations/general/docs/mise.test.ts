import { test, expect } from 'bun:test';
import { parseMiseTasks } from '#cli/configurations/general/docs/mise.ts';

test('mise keeps string tasks, command lists, and task-table aliases', () => {
    expect(
        parseMiseTasks(
            'tasks.build = "echo"\ntasks.test = ["echo test"]\n[tasks.check]\nalias = ["lint", "verify"]\nrun = "echo check"\n',
            'mise.toml',
        ),
    ).toStrictEqual(['build', 'test', 'check', 'lint', 'verify']);
});
