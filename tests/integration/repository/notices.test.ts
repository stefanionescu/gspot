import { expect, spyOn, test } from 'bun:test';
import { join } from 'node:path';
import { createFileTree, testdir } from 'testdirs';
import { dependencyNotices } from '../../../packages/cli/build/notices.ts';

test('bundled dependency notices preserve installed license and attribution bytes without fetching', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'node_modules/fixture/package.json': JSON.stringify({ name: 'fixture', version: '1.0.0', license: 'MIT' }),
        'node_modules/fixture/index.js': 'export const fixture = 1;',
        'node_modules/fixture/LICENSE': 'License fixture\n~~~\nRequired attribution\n',
        'node_modules/unbundled/package.json': JSON.stringify({ name: 'unbundled', version: '1.0.0', license: 'MIT' }),
        'node_modules/unbundled/LICENSE': 'Unbundled license fixture\n',
    });
    using download = spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Unexpected network request.'));
    const notices = await dependencyNotices(
        [{ inputs: { 'node_modules/fixture/index.js': {} }, cwd: directory.path }],
        [join(directory.path, 'node_modules/fixture/index.js')],
    );
    expect(notices).toBe(
        '## fixture@1.0.0\n\nDeclared license: MIT.\n\n### LICENSE\n\n~~~~text\nLicense fixture\n~~~\nRequired attribution\n~~~~\n',
    );
    expect(download).not.toHaveBeenCalled();
});

test('a missing notice for an unrecorded dependency version fails without substituting license terms', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'node_modules/fixture/package.json': JSON.stringify({
            name: '@bomb.sh/tab',
            version: '0.0.23',
            license: 'MIT',
        }),
        'node_modules/fixture/index.js': 'export const fixture = 1;',
    });
    using download = spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Unexpected network request.'));
    await expect(dependencyNotices([], [join(directory.path, 'node_modules/fixture/index.js')])).rejects.toThrow(
        'No license notice is recorded for bundled @bomb.sh/tab@0.0.23.',
    );
    expect(download).not.toHaveBeenCalled();
});
