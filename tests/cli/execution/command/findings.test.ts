import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { planRun } from '#cli/planning/public.ts';
import { testdir, createFileTree } from 'testdirs';
import { GspotError } from '#cli/platform/public.ts';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { TYPO } from '#tests/config/samples/spelling.ts';
import { containing } from '#tests/harness/expectations.ts';
import { checkedFindings } from '#cli/execution/command/contracts.ts';
import { configurationManifests } from '#cli/configurations/public.ts';

import {
    REAL_PATH,
    FALSE_PATH,
    EMPTY_FAILURE,
    LOCATED_CHECK,
    FILELESS_CHECKS,
} from '#tests/config/cli/execution/command/findings.ts';

test('located output rejects false paths and empty failures while retaining mixed real findings', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'source.txt': 'source',
    });
    const planned = {
        check: LOCATED_CHECK,
        manifest: configurationManifests().get('files')!,
        tool: { name: 'tool', installers: {}, kind: 'binary' as const },
    };
    const paths = { cwd: sandbox.path, root: sandbox.path };
    expect(() => checkedFindings(planned, { ...EMPTY_FAILURE, stdout: FALSE_PATH }, paths)).toThrow(
        'tool broke: exit 1',
    );
    expect(() => checkedFindings(planned, EMPTY_FAILURE, paths)).toThrow('tool broke: exit 1');
    expect(checkedFindings(planned, { ...EMPTY_FAILURE, stdout: FALSE_PATH + REAL_PATH }, paths)).toStrictEqual([
        { check: LOCATED_CHECK.name, file: '2026-09-19T02', message: 'FATAL', help: '', fixable: false },
        { check: LOCATED_CHECK.name, file: 'source.txt', message: 'located defect', help: '', fixable: false },
    ]);
    expect(checkedFindings(planned, { ...EMPTY_FAILURE, code: 0 }, paths)).toStrictEqual([]);
    expect(await Bun.file(join(sandbox.path, 'source.txt')).text()).toBe('source');
});

for (const check of FILELESS_CHECKS)
    test(`${check.name} accepts a fileless result without classifying it as a crash`, async () => {
        await using sandbox = await testdir();
        const planned = { check, manifest: configurationManifests().get('files')! };
        expect(checkedFindings(planned, EMPTY_FAILURE, { cwd: sandbox.path, root: sandbox.path })).toStrictEqual([]);
    });

test('pin verification treats a rate limit as an execution error and accepts a completed read', async () => {
    const failure = '429 Too Many Requests';
    await using sandbox = await testdir();
    const workflow = 'jobs:\n  check:\n    steps:\n      - uses: actions/checkout@v4\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['actions']),
        '.github/workflows/check.yml': workflow,
    });
    const session = await openSession(sandbox.path);
    const plans = planRun(session, { stage: 'push', skips: [], only: ['actions/pinact'] });
    const planned = plans[0]!;
    const result = {
        code: 1,
        stdout: '',
        stderr: `ERROR failed to handle a line: GET https://api.github.com/repos/actions/checkout/commits/v4: ${failure}`,
        missing: false,
        duration: 1,
    };
    expect(() => checkedFindings(planned, result, { cwd: sandbox.path, root: sandbox.path })).toThrow(GspotError);
    expect(
        checkedFindings(
            planned,
            { ...result, stderr: 'invalid action pin: .github/workflows/check.yml:4' },
            { cwd: sandbox.path, root: sandbox.path },
        ),
    ).toStrictEqual([
        containing({
            check: 'actions/pinact',
            message: 'invalid action pin: .github/workflows/check.yml:4',
        }),
    ]);
    expect(
        checkedFindings(planned, { ...result, code: 0, stderr: '' }, { cwd: sandbox.path, root: sandbox.path }),
    ).toStrictEqual([]);
    expect(await Bun.file(join(sandbox.path, '.github/workflows/check.yml')).text()).toBe(workflow);
});

test('spelling distinguishes native findings from fatal exits', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['spelling']),
        'sample.txt': `${TYPO.the}\n`,
    });
    const session = await openSession(sandbox.path);
    const plans = planRun(session, { stage: 'all', only: ['spelling/typos'], skips: [] });
    const planned = plans[0]!;
    const stdout = JSON.stringify({
        type: 'typo',
        path: 'sample.txt',
        line_num: 1,
        byte_offset: 0,
        typo: TYPO.the,
        corrections: ['the'],
    });
    const result = { stdout, stderr: '', code: 2, missing: false, duration: 1 };
    expect(checkedFindings(planned, result, { cwd: sandbox.path, root: sandbox.path })).toMatchObject([
        { file: 'sample.txt' },
    ]);
    expect(() =>
        checkedFindings(
            planned,
            { ...result, code: 78, stderr: 'Invalid native configuration.' },
            { cwd: sandbox.path, root: sandbox.path },
        ),
    ).toThrow(GspotError);
    expect(() =>
        checkedFindings(planned, { ...result, stdout: '' }, { cwd: sandbox.path, root: sandbox.path }),
    ).toThrow(GspotError);
    expect(
        checkedFindings(planned, { ...result, stdout: '', code: 0 }, { cwd: sandbox.path, root: sandbox.path }),
    ).toStrictEqual([]);
});

test('source text naming module errors stays an ESLint finding', async () => {
    await using sandbox = await testdir();
    const path = 'source.ts';
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['typescript'], { level: 'all' }),
        [path]: 'const message = "ERR_MODULE_NOT_FOUND";\n',
    });
    const session = await openSession(sandbox.path);
    const plans = planRun(session, { stage: 'all', skips: [], only: ['javascript/eslint'] });
    const planned = plans[0]!;
    const stdout = JSON.stringify([
        {
            filePath: join(sandbox.path, path),
            source: 'const message = "ERR_MODULE_NOT_FOUND"; // ConfigError:',
            messages: [{ ruleId: 'no-unused-vars', severity: 2, message: 'Unused message.', line: 1, column: 7 }],
        },
    ]);
    const result = { stdout, stderr: '', code: 1, missing: false, duration: 1 };
    expect(checkedFindings(planned, result, { cwd: sandbox.path, root: sandbox.path })).toMatchObject([
        { file: path, rule: 'no-unused-vars', line: 1, column: 7 },
    ]);
    expect(() =>
        checkedFindings(
            planned,
            { ...result, code: 2, stderr: 'ConfigError: invalid configuration' },
            { cwd: sandbox.path, root: sandbox.path },
        ),
    ).toThrow(GspotError);
    expect(() =>
        checkedFindings(
            planned,
            { ...result, stdout: '', code: 2, stderr: 'Oops! Something went wrong!\nERR_MODULE_NOT_FOUND: plugin' },
            { cwd: sandbox.path, root: sandbox.path },
        ),
    ).toThrow('ERR_MODULE_NOT_FOUND: plugin');
});
