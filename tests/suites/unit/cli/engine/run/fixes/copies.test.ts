import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';

import { selectCheckCode } from '#cli/configurations/registry.ts';
import { buildCheckSession } from '#cli/engine/run/checks.ts';
import { runFixers } from '#cli/engine/run/fixes.ts';
import { openSession } from '#cli/engine/session.ts';
import { CHECK_GENERATION } from '#cli/generation/stale.ts';
import { buildFixerSettings, planFixer } from '#tests/setup/cli/run.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { buildProgramCommand, readCallRecords } from '#tests/setup/system/programs.ts';

test('a fix in a copy writes only the selected file back and removes the copy', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildFixerSettings(),
        'source.txt': 'original',
        'unowned.json': '{}',
    });

    const session = await openSession(sandbox.path);
    const trace = join(sandbox.path, 'workspace-path');
    const planned = planFixer(
        session,
        buildProgramCommand(
            'fakes/tool',
            '--refuse-file',
            'unowned.json',
            '--record',
            trace,
            '--write',
            'source.txt=corrected',
            '--exit',
            '3',
        ),
    );
    planned.check = { ...planned.check, run_in_copy: true, exit_codes: [3] };
    const result = await runFixers(buildCheckSession(session, CHECK_GENERATION), [planned], selectCheckCode);
    expect(result.results).toMatchObject([{ status: 'changed', changed: ['source.txt'] }]);
    expect(await readFile(join(sandbox.path, 'source.txt'), 'utf8')).toBe('corrected');
    const [call] = await readCallRecords(trace);
    expect(existsSync(call?.cwd ?? '')).toBe(false);
});

test('a fixer in a copy that deletes a file deletes it from the working tree', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildFixerSettings(), 'source.txt': 'original' });
    const session = await openSession(sandbox.path);
    const planned = planFixer(session, buildProgramCommand('fakes/tool', '--delete', 'source.txt'));
    planned.check = { ...planned.check, run_in_copy: true };
    const fixed = await runFixers(buildCheckSession(session, CHECK_GENERATION), [planned], selectCheckCode);
    expect(fixed.changed).toStrictEqual(['source.txt']);
    expect(existsSync(join(sandbox.path, 'source.txt'))).toBe(false);
});
