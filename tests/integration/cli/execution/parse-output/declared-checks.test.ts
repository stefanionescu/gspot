import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { planRun } from '#cli/execution/plan.ts';
import { createFileTree, testdir } from 'testdirs';
import { openSession } from '#cli/execution/session.ts';
import { containing } from '#tests/support/expectations.ts';
import { checkedFindings } from '#cli/execution/broken-tool.ts';
import { ToolOutputError } from '#cli/execution/output/tool-formats.ts';

test.each([
    '403 API rate limit exceeded',
    '429 Too Many Requests',
    '503 Service Unavailable',
    'dial tcp: no such host',
])('pin verification treats %s as an execution error and accepts a completed observation', async (failure) => {
    await using sandbox = await testdir();
    const workflow = 'jobs:\n  check:\n    steps:\n      - uses: actions/checkout@v4\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nconfigurations = ["configs"]\n',
        '.github/workflows/check.yml': workflow,
    });
    const session = await openSession(sandbox.path);
    const plans = await planRun(session, { stage: 'push', skips: [], only: ['configs/actions-pins'] });
    const planned = plans[0]!;
    const result = {
        code: 1,
        stdout: '',
        stderr: `ERROR failed to handle a line: GET https://api.github.com/repos/actions/checkout/commits/v4: ${failure}`,
        missing: false,
        duration: 1,
    };
    expect(() => checkedFindings(planned, result, [sandbox.path, sandbox.path])).toThrow(ToolOutputError);
    expect(
        checkedFindings(planned, { ...result, stderr: 'invalid action pin: .github/workflows/check.yml:4' }, [
            sandbox.path,
            sandbox.path,
        ]),
    ).toStrictEqual([
        containing({
            check: 'configs/actions-pins',
            message: 'invalid action pin: .github/workflows/check.yml:4',
        }),
    ]);
    expect(checkedFindings(planned, { ...result, code: 0, stderr: '' }, [sandbox.path, sandbox.path])).toStrictEqual(
        [],
    );
    expect(await Bun.file(join(sandbox.path, '.github/workflows/check.yml')).text()).toBe(workflow);
});

test('spelling distinguishes native findings from fatal exits for configuration and declared checks', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nconfigurations = ["spelling"]\n',
        'sample.txt': 'teh\n',
    });
    const session = await openSession(sandbox.path);
    const plans = await planRun(session, { stage: 'all', only: ['spelling/typos'], skips: [] });
    const planned = plans[0]!;
    const declared = { ...planned };
    delete declared.manifest;
    const stdout = JSON.stringify({
        type: 'typo',
        path: 'sample.txt',
        line_num: 1,
        byte_offset: 0,
        typo: 'teh',
        corrections: ['the'],
    });
    const result = { stdout, stderr: '', code: 2, missing: false, duration: 1 };
    for (const check of [planned, declared]) {
        expect(checkedFindings(check, result, [sandbox.path, sandbox.path])).toMatchObject([{ file: 'sample.txt' }]);
        expect(() =>
            checkedFindings(check, { ...result, code: 78, stderr: 'Invalid native configuration.' }, [
                sandbox.path,
                sandbox.path,
            ]),
        ).toThrow(ToolOutputError);
        expect(() => checkedFindings(check, { ...result, stdout: '' }, [sandbox.path, sandbox.path])).toThrow(
            ToolOutputError,
        );
        expect(checkedFindings(check, { ...result, stdout: '', code: 0 }, [sandbox.path, sandbox.path])).toStrictEqual(
            [],
        );
    }
});

test.each(
    ['javascript', 'typescript'].flatMap((configuration) =>
        ['recommended', 'all'].map((level) => ({ configuration, level })),
    ),
)(
    '$configuration at $level keeps source text naming module errors as an ESLint finding',
    async ({ configuration, level }) => {
        await using sandbox = await testdir();
        const extension = configuration === 'javascript' ? 'js' : 'ts';
        const path = `source.${extension}`;
        await createFileTree(sandbox.path, {
            'gspot.toml': `version = 1\nlevel = "${level}"\nconfigurations = ["${configuration}"]\n`,
            [path]: 'const message = "ERR_MODULE_NOT_FOUND";\n',
        });
        const session = await openSession(sandbox.path);
        const plans = await planRun(session, { stage: 'all', skips: [], only: [`${configuration}/eslint`] });
        const planned = plans[0]!;
        const stdout = JSON.stringify([
            {
                filePath: join(sandbox.path, path),
                source: 'const message = "ERR_MODULE_NOT_FOUND"; // ConfigError:',
                messages: [{ ruleId: 'no-unused-vars', severity: 2, message: 'Unused message.', line: 1, column: 7 }],
            },
        ]);
        const result = { stdout, stderr: '', code: 1, missing: false, duration: 1 };
        expect(checkedFindings(planned, result, [sandbox.path, sandbox.path])).toMatchObject([
            { file: path, rule: 'no-unused-vars', line: 1, column: 7 },
        ]);
        expect(() =>
            checkedFindings(planned, { ...result, code: 2, stderr: 'ConfigError: invalid configuration' }, [
                sandbox.path,
                sandbox.path,
            ]),
        ).toThrow(ToolOutputError);
        expect(() =>
            checkedFindings(
                planned,
                { ...result, stdout: '', code: 2, stderr: 'Oops! Something went wrong!\nERR_MODULE_NOT_FOUND: plugin' },
                [sandbox.path, sandbox.path],
            ),
        ).toThrow('ERR_MODULE_NOT_FOUND: plugin');
    },
);
