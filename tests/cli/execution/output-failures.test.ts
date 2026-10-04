import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { checkedFindings } from '#cli/execution/output.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { EMPTY_FAILURE } from '#tests/config/cli/execution/output/shared.ts';
import { REAL_PATH, FALSE_PATH, LOCATED_CHECK, FILELESS_CHECKS } from '#tests/config/cli/execution/output/failures.ts';

test('located output rejects false paths and empty failures while retaining mixed real findings', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'source.txt': 'source',
    });
    const planned = {
        spec: LOCATED_CHECK,
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

for (const spec of FILELESS_CHECKS)
    test(`${spec.name} accepts a fileless result without classifying it as a crash`, async () => {
        await using sandbox = await testdir();
        const planned = { spec, manifest: configurationManifests().get('files')! };
        expect(checkedFindings(planned, EMPTY_FAILURE, { cwd: sandbox.path, root: sandbox.path })).toStrictEqual([]);
    });
