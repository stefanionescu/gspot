import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';

import { planBlock, planRemovals, writePlans } from '#cli/repository/writer.ts';
import { openFiles } from '#cli/system/files/open.ts';

test('managed block updates and removal keep your text around the block', async () => {
    await using sandbox = await testdir();
    const previous = '# Authored\r\n\r\nKeep these trailing lines.\r\n\r\n';
    await createFileTree(sandbox.path, { 'AGENTS.md': previous });
    const prefix = 'Additional instructions.\n';
    const suffix = '\nLater authored instructions.\n';
    const firstWriter = openFiles(sandbox.path);
    writePlans(firstWriter, [planBlock(firstWriter, 'AGENTS.md', 'first instructions')]);
    const installed = firstWriter.read('AGENTS.md')!.bytes.toString('utf8');
    expect(installed).toBe(
        `${previous}\r\n<!-- >>> gspot managed >>> -->\r\n\r\nfirst instructions\r\n\r\n<!-- <<< gspot managed <<< -->\r\n`,
    );
    await writeFile(join(sandbox.path, 'AGENTS.md'), prefix + installed + suffix);
    writePlans(firstWriter, [planBlock(firstWriter, 'AGENTS.md', 'updated instructions')]);
    expect(firstWriter.read('AGENTS.md')!.bytes.toString('utf8')).toBe(
        `${prefix}${previous}\r\n<!-- >>> gspot managed >>> -->\n\nupdated instructions\n\n<!-- <<< gspot managed <<< -->\n${suffix}`,
    );
    const writer = openFiles(sandbox.path);
    writePlans(writer, planRemovals(writer, ['AGENTS.md']));
    expect(writer.read('AGENTS.md')!.bytes.toString('utf8')).toBe(prefix + previous + suffix);
});

test('removing the only block deletes the file', async () => {
    await using sandbox = await testdir({ 'AGENTS.md': '' });

    const writer = openFiles(sandbox.path);

    writePlans(writer, [planBlock(writer, 'AGENTS.md', 'instructions')]);
    writePlans(writer, planRemovals(writer, ['AGENTS.md']));
    expect(writer.read('AGENTS.md')).toBeUndefined();
});
