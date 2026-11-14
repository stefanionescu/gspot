import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { GSPOT_FOLDER } from '#cli/config/system.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { GSPOT_CHECK } from '#cli/config/manifests.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import type { GspotError } from '#cli/system/errors.ts';
import { isWindows } from '#tests/setup/system/platform.ts';
import { parse as parseToml } from '@decimalturn/toml-patch';
import { stat, chmod, unlink, readFile, writeFile } from 'node:fs/promises';
import { STYLELINT_PACKAGE_JSON } from '#tests/config/setup/configurations.ts';

import {
    planBlock,
    writePlans,
    planRemovals,
    planManagedKeys,
    planReplacements,
} from '#cli/repository/files/writes.ts';

const AUTHORED_REFUSAL = matchFields<GspotError>({
    name: 'GspotError',
    code: 'writing',
    message: expect.stringContaining('authored.txt') as string,
});

test('managed JSON keys survive reopening and updates and keep other bytes and the mode', async () => {
    await using sandbox = await testdir();
    const path = 'package.json';
    const previous = STYLELINT_PACKAGE_JSON.replaceAll('\n', '\r\n');
    await createFileTree(sandbox.path, { [path]: previous });
    await chmod(join(sandbox.path, path), 0o640);
    const changes = [{ key: ['stylelint'], value: { extends: './.stylelintrc.yml' } }];
    const firstWriter = openFiles(sandbox.path);
    writePlans(firstWriter, [planManagedKeys(firstWriter, path, changes)]);
    expect(planManagedKeys(firstWriter, path, changes).status).toBe('unchanged');
    const installed = firstWriter.read(path)!.bytes.toString('utf8');
    expect(installed).toBe(
        previous.replace('{"rules":{"property-no-unknown":null}}', '{"extends":"./.stylelintrc.yml"}'),
    );
    await writeFile(join(sandbox.path, path), installed.replace('native-project', 'edited-project'));
    const writer = openFiles(sandbox.path);
    writePlans(writer, [planManagedKeys(writer, path, [{ key: ['stylelint'], value: { extends: './next.json' } }])]);
    expect(planManagedKeys(writer, path, changes).status).toBe('changed');
    expect(await readFile(join(sandbox.path, path), 'utf8')).toBe(
        previous
            .replace('native-project', 'edited-project')
            .replace('{"rules":{"property-no-unknown":null}}', '{"extends":"./next.json"}'),
    );
    const metadata = await stat(join(sandbox.path, path));
    expect(metadata.mode & 0o777).toBe(isWindows ? 0o666 : 0o640);
});

test('tool.jsonc key edits keep comments, containers and array order', async () => {
    const path = 'tool.jsonc';
    await using sandbox = await testdir();
    const previous = '// Keep this comment.\n{ "kept": {}, "entries": [0, false, ""], }\n';
    await createFileTree(sandbox.path, { [path]: previous });
    const writer = openFiles(sandbox.path);
    const fields = [
        { key: ['created', 'nested', 'owned'], value: 0 },
        { key: ['kept', 'owned'], value: false },
    ];
    writePlans(writer, [planManagedKeys(writer, path, fields)]);
    expect(planManagedKeys(writer, path, fields).status).toBe('unchanged');
    const written =
        '// Keep this comment.\n{ "kept": {"owned": false}, "entries": [0, false, ""],"created": {"nested":{"owned":0}}, }\n';
    expect(writer.read(path)!.bytes.toString('utf8')).toBe(written);
});

test('managed TOML keys refuse a malformed file, create missing tables, and write back an edited managed value', async () => {
    await using sandbox = await testdir({ 'broken.toml': '[tasks\n' });

    const writer = openFiles(sandbox.path);
    const changes = [{ key: ['tasks', 'gspot:check', 'run'], value: GSPOT_CHECK }];
    expect(() => planManagedKeys(writer, 'broken.toml', changes)).toThrow(
        matchFields<GspotError>({
            name: 'GspotError',
            code: 'parse',
            message: expect.stringContaining('broken.toml') as string,
        }),
    );
    expect(await readFile(join(sandbox.path, 'broken.toml'), 'utf8')).toBe('[tasks\n');
    writePlans(writer, [planManagedKeys(writer, 'mise.toml', changes)]);
    const installed = await readFile(join(sandbox.path, 'mise.toml'), 'utf8');
    expect(parseToml(installed)).toStrictEqual({ tasks: { 'gspot:check': { run: GSPOT_CHECK } } });
    await writeFile(join(sandbox.path, 'mise.toml'), installed.replace(GSPOT_CHECK, 'authored check'));
    writePlans(writer, [planManagedKeys(writer, 'mise.toml', changes)]);
    expect(await readFile(join(sandbox.path, 'mise.toml'), 'utf8')).toBe(installed);
});

test('a managed TOML key update keeps the edits next to it', async () => {
    await using sandbox = await testdir();
    const previous = '# Keep this comment.\nextends = "./authored.json"\n[compilerOptions]\nstrict = false\n';
    await createFileTree(sandbox.path, { 'compiler.toml': previous });
    const firstWriter = openFiles(sandbox.path);
    writePlans(firstWriter, [
        planManagedKeys(firstWriter, 'compiler.toml', [{ key: ['extends'], value: './.gspot/first.json' }]),
    ]);
    const installed = firstWriter.read('compiler.toml')!.bytes.toString('utf8');
    const edited = installed.replace('strict = false', 'strict = true');
    await writeFile(join(sandbox.path, 'compiler.toml'), edited);
    writePlans(firstWriter, [
        planManagedKeys(firstWriter, 'compiler.toml', [{ key: ['extends'], value: './.gspot/second.json' }]),
    ]);
    expect(firstWriter.read('compiler.toml')!.bytes.toString('utf8')).toBe(
        edited.replace('./.gspot/first.json', './.gspot/second.json'),
    );
});

test('setting a TOML key to the value it holds keeps the bytes and mode', async () => {
    await using sandbox = await testdir();
    const content = 'authored = true\n[scripts]\ncheck = "gspot check"\n';
    await createFileTree(sandbox.path, { 'package.toml': content });
    await chmod(join(sandbox.path, 'package.toml'), 0o640);
    const writer = openFiles(sandbox.path);
    writePlans(writer, [planManagedKeys(writer, 'package.toml', [{ key: ['scripts', 'check'], value: GSPOT_CHECK }])]);
    expect(await readFile(join(sandbox.path, 'package.toml'), 'utf8')).toBe(content);
    const metadata = await stat(join(sandbox.path, 'package.toml'));
    expect(metadata.mode & 0o777).toBe(isWindows ? 0o666 : 0o640);
});

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

test('a batch writes binary bytes, and a removal plan deletes one file and keeps the other', async () => {
    await using sandbox = await testdir();
    const writer = openFiles(sandbox.path);
    const first = Buffer.from([0, 255, 10]);
    const second = Buffer.from([255, 0, 13]);
    writePlans(
        writer,
        planReplacements(writer, [
            { path: `${GSPOT_FOLDER}/first.bin`, next: { bytes: first, mode: 0o644 } },
            { path: `${GSPOT_FOLDER}/second.bin`, next: { bytes: second, mode: 0o644 } },
        ]),
    );
    expect(await readFile(join(sandbox.path, `${GSPOT_FOLDER}/first.bin`))).toStrictEqual(first);
    expect(await readFile(join(sandbox.path, `${GSPOT_FOLDER}/second.bin`))).toStrictEqual(second);
    writePlans(writer, [{ path: `${GSPOT_FOLDER}/first.bin`, status: 'changed' }]);
    expect(writer.findStats(`${GSPOT_FOLDER}/first.bin`)).toBeUndefined();
    expect(await readFile(join(sandbox.path, `${GSPOT_FOLDER}/second.bin`))).toStrictEqual(second);
});

test('a file gspot does not own refuses the whole batch and leaves every file as it was', async () => {
    await using sandbox = await testdir({ [`${GSPOT_FOLDER}/owned.txt`]: 'original', 'authored.txt': 'keep authored' });

    const writer = openFiles(sandbox.path);

    writePlans(
        writer,
        planReplacements(writer, [
            {
                path: `${GSPOT_FOLDER}/owned.txt`,
                next: { bytes: Buffer.from('installed'), mode: 0o644 },
                previous: writer.read(`${GSPOT_FOLDER}/owned.txt`),
            },
        ]),
    );
    const plans = planReplacements(
        writer,
        [`${GSPOT_FOLDER}/owned.txt`, 'authored.txt'].map((path) => ({
            path,
            next: { bytes: Buffer.from('replacement'), mode: 0o644 },
        })),
    );
    expect(() => {
        writePlans(writer, plans);
    }).toThrow(AUTHORED_REFUSAL);
    expect(await readFile(join(sandbox.path, `${GSPOT_FOLDER}/owned.txt`), 'utf8')).toBe('installed');
    expect(await readFile(join(sandbox.path, 'authored.txt'), 'utf8')).toBe('keep authored');
});

test.each(['edited', 'deleted'])('a reviewed authored file that was %s is not replaced', async (change) => {
    await using sandbox = await testdir({ 'authored.txt': 'reviewed\n' });
    const writer = openFiles(sandbox.path);
    const previous = writer.read('authored.txt');
    await (change === 'edited'
        ? writeFile(join(sandbox.path, 'authored.txt'), 'new edit\n')
        : unlink(join(sandbox.path, 'authored.txt')));
    const plans = planReplacements(writer, [
        { path: 'authored.txt', previous, next: { bytes: Buffer.from('generated\n'), mode: 0o644 } },
    ]);
    expect(() => {
        writePlans(writer, plans);
    }).toThrow(AUTHORED_REFUSAL);
    expect(writer.read('authored.txt')?.bytes.toString('utf8')).toBe(change === 'edited' ? 'new edit\n' : undefined);
});
