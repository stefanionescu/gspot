import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { unlink } from 'node:fs/promises';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { planRun, isActive } from '#cli/planning/public.ts';
import { LOCKFILE_TRIGGER_NAMES } from '#tests/config/cli/planning/lockfiles.ts';

test.each(['recommended', 'all'] as const)('%s frozen installs run only for declared changed inputs', async (level) => {
    await using sandbox = await testdir({
        ...Object.fromEntries(
            LOCKFILE_TRIGGER_NAMES.flatMap((filename) => [
                [filename, ''],
                ['app/' + filename, ''],
            ]),
        ),
        'ignored/package.json': '{"name":"ignored","private":true}\n',
        'gspot.toml': buildPolicy(['dependencies'], {
            level,
            tables: '[[ignore]]\ncheck = "dependencies/stale-lockfile"\npaths = ["ignored/**"]\nreason = "This external project has its own installation."\n[scope.app]\nconfigurations = ["dependencies"]\n',
        }),
        'package.json': '{"name":"root","private":true}\n',
        'bun.lock': 'Root lock.\n',
        'source.txt': 'Root source.\n',
        'app/package.json': '{"name":"child","private":true}\n',
        'app/source.txt': 'Child source.\n',
    });
    const session = await openSession(sandbox.path);
    const options = { stage: 'push' as const, skips: [], only: ['dependencies/stale-lockfile'] };
    const [whole] = planRun(session, options);
    expect(whole!.check.needs).toStrictEqual(['network']);
    for (const prefix of ['', 'app/']) {
        for (const filename of LOCKFILE_TRIGGER_NAMES) {
            const [triggered] = planRun(session, { ...options, staged: [prefix + filename] });
            expect(isActive(triggered!), prefix + filename).toBe(true);
            expect(triggered!.files).toStrictEqual(whole!.files);
        }
        const [unrelated] = planRun(session, { ...options, staged: [prefix + 'source.txt'] });
        expect(isActive(unrelated!)).toBe(false);
    }
    expect(isActive(planRun(session, { ...options, staged: ['ignored/package.json'] })[0]!)).toBe(false);
    expect(isActive(planRun(session, { ...options, changed: ['source.txt'] })[0]!)).toBe(false);
    await unlink(join(sandbox.path, 'app/uv.lock'));
    const reopened = await openSession(sandbox.path);
    const [deleted] = planRun(reopened, { ...options, staged: ['app/uv.lock'] });
    expect(deleted!.triggerPaths).toStrictEqual(['app/uv.lock']);
    expect(isActive(deleted!)).toBe(true);
    expect(isActive(planRun(session, { ...options, staged: ['gspot.toml'] })[0]!)).toBe(true);
    expect(isActive(planRun(session, { ...options, staged: ['.gspot/config/settings.json'] })[0]!)).toBe(true);
});
