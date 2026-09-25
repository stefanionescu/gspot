import { resolveCheck } from '#cli/execution/engines.ts';
import { planRun } from '#cli/execution/plan.ts';
import { openSession } from '#cli/execution/session.ts';
import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { createFileTree, testdir } from 'testdirs';

test.each(['$/', '"$/', '"\\u0024/', '|- # $comment\n            $/'])(
    'Actionlint accepts self-repository scalar %s while retaining expression errors and source bytes',
    async (prefix) => {
        await using sandbox = await testdir();
        const suffix = prefix.startsWith('"') ? '"' : '';
        const reference = `${prefix}.github/workflows/called.yml${suffix}`;
        const workflow = `name: Caller\non: workflow_dispatch\npermissions: {}\njobs:\n    caller:\n        uses: ${reference}\n        with:\n            greeting: \${{ unknown.value }}\n`;
        await createFileTree(sandbox.path, {
            'gspot.toml': 'version = 1\nconfigurations = ["configs"]\n',
            '.github/workflows/caller.yml': workflow,
            '.github/workflows/called.yml':
                'name: Called\non:\n    workflow_call:\n        inputs:\n            greeting:\n                type: string\n                required: true\npermissions: {}\njobs:\n    greet:\n        runs-on: ubuntu-latest\n        steps:\n            - run: echo "$GREETING"\n              env:\n                  GREETING: ${{ inputs.greeting }}\n',
            'unrelated.yaml': '42\n',
        });
        const session = await openSession(sandbox.path);
        const planned = (await planRun(session, { stage: 'commit', skips: [], only: ['configs/actions'] }))[0]!;
        const failed = await resolveCheck(planned.spec)(session, planned);
        expect(failed.status, JSON.stringify(failed)).toBe('fail');
        expect(failed.findings).toContainEqual(
            expect.objectContaining({
                file: '.github/workflows/caller.yml',
                rule: 'expression',
                line: prefix.startsWith('|') ? 9 : 8,
            }),
        );
        expect(failed.findings.some((finding) => finding.rule === 'workflow-call')).toBe(false);
        expect(await Bun.file(join(sandbox.path, '.github/workflows/caller.yml')).text()).toBe(workflow);
        await Bun.write(
            join(sandbox.path, '.github/workflows/caller.yml'),
            workflow.replace('${{ unknown.value }}', 'Hello'),
        );
        const corrected = await openSession(sandbox.path);
        const valid = (await planRun(corrected, { stage: 'commit', skips: [], only: ['configs/actions'] }))[0]!;
        expect((await resolveCheck(valid.spec)(corrected, valid)).status).toBe('ok');
        expect(await Bun.file(join(sandbox.path, 'unrelated.yaml')).text()).toBe('42\n');
    },
);

test.each(['$/', '"$/', "'$/", '"\\x24/', '"\\u0024/', '"\\U00000024/', '|-\n          $/', '>-\n          $/'])(
    'Actionlint validates reusable inputs for scalar %s and preserves authored files',
    async (prefix) => {
        await using sandbox = await testdir();
        const quote = prefix.startsWith('"') ? '"' : prefix.startsWith("'") ? "'" : '';
        const workflow = `on: workflow_dispatch\njobs:\n  caller:\n    uses: ${prefix}.github/workflows/called.yml${quote}\n`;
        const called =
            'on:\n  workflow_call:\n    inputs:\n      greeting:\n        type: string\n        required: true\njobs:\n  greet:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo hello\n';
        await createFileTree(sandbox.path, {
            'gspot.toml': 'version = 1\nconfigurations = ["configs"]\n',
            '.github/workflows/caller.yml': workflow,
            '.github/workflows/called.yml': called,
        });
        const session = await openSession(sandbox.path);
        const planned = (await planRun(session, { stage: 'commit', skips: [], only: ['configs/actions'] }))[0]!;
        const failed = await resolveCheck(planned.spec)(session, planned);
        expect(failed.status, JSON.stringify(failed)).toBe('fail');
        expect(failed.findings).toContainEqual(
            expect.objectContaining({
                file: '.github/workflows/caller.yml',
                line: 4,
                column: 11,
                rule: 'workflow-call',
                message: expect.stringContaining('input "greeting" is required'),
            }),
        );
        expect(await Bun.file(join(sandbox.path, '.github/workflows/caller.yml')).text()).toBe(workflow);
        await Bun.write(
            join(sandbox.path, '.github/workflows/caller.yml'),
            `${workflow}    with:\n      greeting: Hello\n`,
        );
        const corrected = await openSession(sandbox.path);
        const valid = (await planRun(corrected, { stage: 'commit', skips: [], only: ['configs/actions'] }))[0]!;
        expect((await resolveCheck(valid.spec)(corrected, valid)).status).toBe('ok');
        expect(await Bun.file(join(sandbox.path, '.github/workflows/called.yml')).text()).toBe(called);
    },
);

test('Actionlint resolves a self-repository alias and reports a missing workflow before correction', async () => {
    await using sandbox = await testdir();
    const workflow =
        'on: workflow_dispatch\nenv:\n  WORKFLOW: &workflow $/.github/workflows/called.yml\njobs:\n  caller:\n    uses: *workflow\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nconfigurations = ["configs"]\n',
        '.github/workflows/caller.yml': workflow,
    });
    const session = await openSession(sandbox.path);
    const planned = (await planRun(session, { stage: 'commit', skips: [], only: ['configs/actions'] }))[0]!;
    const failed = await resolveCheck(planned.spec)(session, planned);
    expect(failed.status, JSON.stringify(failed)).toBe('fail');
    expect(failed.findings).toContainEqual(
        expect.objectContaining({
            file: '.github/workflows/caller.yml',
            line: 3,
            column: 13,
            rule: 'workflow-call',
            message: expect.stringContaining('could not read reusable workflow file'),
        }),
    );
    await Bun.write(
        join(sandbox.path, '.github/workflows/called.yml'),
        'on: workflow_call\njobs:\n  greet:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo hello\n',
    );
    const corrected = await openSession(sandbox.path);
    const valid = (await planRun(corrected, { stage: 'commit', skips: [], only: ['configs/actions'] }))[0]!;
    expect((await resolveCheck(valid.spec)(corrected, valid)).status).toBe('ok');
    expect(await Bun.file(join(sandbox.path, '.github/workflows/caller.yml')).text()).toBe(workflow);
});
