// Planted repository: a [[check]] entry of the repository itself, with an output format that gives file and line.
import { join } from 'node:path';
import { createFixture } from 'fs-fixture';
import { describe, expect, test } from 'bun:test';
import { commitAll, PLANTED_TIMEOUT_MS, run, script, toolsPath } from '#tests/harness/planted.ts';

const ENTRY = String.raw`
[[check]]
id = "notes/no-fixme"
command = ["grep", "-n", "-H", "FIXME", "{files}"]
paths = ["notes/**"]
stage = "commit"
count_regex = "FIXME"
summary = "Finds FIXME notes left in the notes folder."

[check.output]
format = "regex"
pattern = "^(?<file>[^:]+):(?<line>\\d+):(?<message>.*)$"
`;

describe('a [[check]] entry', () => {
    test('reruns a repository check when an input outside its selected paths changes', async () => {
        const command = [
            process.execPath,
            '-e',
            "process.exit((await Bun.file('state.txt').text()) === 'valid' ? 0 : 1)",
        ];
        await using fixture = await createFixture({
            '.gitignore': '.gspot/\n',
            'gspot.toml': `version = 1
presets = []

[[check]]
id = "notes/state"
command = ${JSON.stringify(command)}
paths = ["selected.txt"]
stage = "commit"
`,
            'selected.txt': 'unchanged trigger',
            'state.txt': 'invalid',
        });
        const failed = await run(fixture.path, ['check', 'notes/state']);
        expect(failed.code).toBe(1);
        expect(failed.stdout).toContain('notes/state');

        await Bun.write(join(fixture.path, 'state.txt'), 'valid');
        const passed = await run(fixture.path, ['check', 'notes/state']);
        expect(passed.code).toBe(0);
        expect(passed.stdout).toContain('notes/state');

        await Bun.write(join(fixture.path, 'state.txt'), 'invalid');
        const failedAgain = await run(fixture.path, ['check', 'notes/state']);
        expect(failedAgain.code).toBe(1);
        expect(failedAgain.stdout).toContain('notes/state');
    });

    test(
        'runs the command of the repository and reports file and line through its output format',
        async () => {
            await using fixture = await createFixture({
                'scripts/a.sh': script,
                'notes/plan.txt': 'one\nFIXME later\n',
            });
            commitAll(fixture.path);
            const environment = { PATH: toolsPath(['ast-grep', 'shellcheck', 'shfmt']) };
            await run(
                fixture.path,
                [
                    'init',
                    '--yes',
                    '--presets',
                    'bash',
                    '--runner',
                    'none',
                    '--ci',
                    'none',
                    '--no-rules',
                    '--no-install',
                ],
                environment,
            );
            const policy = join(fixture.path, 'gspot.toml');
            await Bun.write(policy, `${await Bun.file(policy).text()}${ENTRY}`);
            const check = await run(fixture.path, ['check', 'notes/no-fixme'], environment);
            expect(check.code).toBe(1);
            expect(check.stdout).toContain('notes/plan.txt:2');
            expect(check.stdout).toContain('FIXME later');
        },
        PLANTED_TIMEOUT_MS,
    );
});
