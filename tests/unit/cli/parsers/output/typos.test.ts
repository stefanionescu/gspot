import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { parseOutput } from '#cli/parsers/output/formats.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { TYPO, TYPO_REPORT } from '#tests/config/spelling.ts';
import { readManifests, listChecksById } from '#cli/configurations/manifests.ts';

test('a typos record becomes a finding', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'sample.txt': `${TYPO.the}\n` });
    const check = listChecksById(readManifests(createReadCache(process.cwd())).values()).get('spelling/typos')!.check;
    const valid = TYPO_REPORT;
    expect(parseOutput(check, JSON.stringify(valid), '', { root: sandbox.path, cwd: sandbox.path })).toMatchObject([
        { file: 'sample.txt', line: 1, column: 1 },
    ]);
});
