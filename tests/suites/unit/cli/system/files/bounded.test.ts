import * as fs from 'node:fs';
import { testdir } from 'testdirs';
import { test, spyOn, expect } from 'bun:test';
import { replaceBounded } from '#cli/system/files/bounded.ts';

test('a failed staged write removes its temporary file and preserves the destination', async () => {
    await using sandbox = await testdir({ 'source.txt': 'before' });
    const failure = new Error('The mode change failed.');
    using _chmod = spyOn(fs, 'fchmodSync').mockImplementation(() => {
        throw failure;
    });
    expect(() => {
        replaceBounded({ root: sandbox.path }, 'source.txt', { bytes: Buffer.from('after'), mode: 0o644 });
    }).toThrow(failure);
    expect(fs.readdirSync(sandbox.path)).toStrictEqual(['source.txt']);
    expect(fs.readFileSync(`${sandbox.path}/source.txt`, 'utf8')).toBe('before');
});
