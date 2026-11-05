import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';
import { createFileTree } from 'testdirs';

import { checkGeneratorOutputs } from '#cli/configurations/generator-outputs.ts';
import { buildCheckSession, runCheckCode } from '#cli/engine/run.ts';
import { openSession } from '#cli/engine/session.ts';
import { GENERATOR_CASES, PROJECT_NOTES, UNTRACKED_NOTES } from '#tests/config/configurations/general.ts';
import { EMPTY_DEFAULT_SOURCE } from '#tests/config/setup/languages.ts';
import { planSandboxCheck } from '#tests/setup/cli/checks.ts';
import { CHECK_GENERATION, CHECK_RUN_OPTIONS } from '#tests/setup/cli/run.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { commitAll } from '#tests/setup/system/git.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';

async function prepareGeneratorCheck(root: string, scenario: (typeof GENERATOR_CASES)[number]) {
    await createFileTree(root, {
        'gspot.toml': buildSandboxSettings([scenario.configuration], { tables: scenario.tables }),
        'package.json': '{"private":true}\n',
        'schema.txt': 'failure',
        'drizzle.config.ts': EMPTY_DEFAULT_SOURCE,
        'notes.txt': PROJECT_NOTES,
        [scenario.output]: 'original',
    });
    commitAll(root);
    await writeFile(join(root, scenario.output), 'dirty');
    await writeFile(join(root, 'untracked.txt'), UNTRACKED_NOTES);
    const session = await openSession(root);
    const input = planSandboxCheck(session, scenario.check);
    return {
        session,
        planned: {
            ...input,
            check: { ...input.check, command: buildProgramCommand('fakes/generator', scenario.output) },
        },
    };
}

test.each([...GENERATOR_CASES])(
    '$configuration generator reports a failed run and a stale file and leaves the files unchanged',
    async (row) => {
        await using sandbox = await createGitSandbox({});
        const { session, planned } = await prepareGeneratorCheck(sandbox.path, row);
        const error = await captureRejection(
            runCheckCode(
                buildCheckSession(session, CHECK_GENERATION),
                planned,
                { check: checkGeneratorOutputs },
                CHECK_RUN_OPTIONS,
            ),
        );
        expect(error).toMatchObject({ name: 'CheckStop', status: 'error' });
        expect(error.message).toContain('Generation failed\nfailure');
        await writeFile(join(sandbox.path, 'schema.txt'), 'changed');
        const stale = await runCheckCode(
            buildCheckSession(session, CHECK_GENERATION),
            planned,
            { check: checkGeneratorOutputs },
            CHECK_RUN_OPTIONS,
        );
        expect(stale.findings.map(({ check, file, rule }) => ({ check, file, rule }))).toStrictEqual([
            { check: row.check, file: row.output, rule: 'stale' },
        ]);
        await writeFile(join(sandbox.path, 'schema.txt'), 'dirty');
        const fresh = await runCheckCode(
            buildCheckSession(session, CHECK_GENERATION),
            planned,
            { check: checkGeneratorOutputs },
            CHECK_RUN_OPTIONS,
        );
        expect(fresh.findings).toStrictEqual([]);
        expect(await readFile(join(sandbox.path, row.output), 'utf8')).toBe('dirty');
        expect(await readFile(join(sandbox.path, 'notes.txt'), 'utf8')).toBe(PROJECT_NOTES);
        expect(await readFile(join(sandbox.path, 'untracked.txt'), 'utf8')).toBe(UNTRACKED_NOTES);
    },
);
