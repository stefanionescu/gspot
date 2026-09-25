import { run } from '#cli/platform/spawn.ts';
import { withRevisionSnapshot } from '#cli/repository/revisions/snapshot.ts';
import { relocateWindowsLauncher } from '#cli/repository/windows-launcher.ts';
import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createFileTree, testdir } from 'testdirs';

function launcher(
    is64: boolean,
    kind = 1,
    interpreter = String.raw`C:\working project\.venv\Scripts\python.exe`,
): Buffer<ArrayBuffer> {
    const bytes = Buffer.alloc(2560);
    bytes.write('MZ');
    bytes.writeUInt32LE(128, 60);
    bytes.write('PE\0\0', 128);
    bytes.writeUInt16LE(1, 134);
    bytes.writeUInt16LE(is64 ? 240 : 224, 148);
    const optional = 152;
    bytes.writeUInt16LE(is64 ? 0x2_0b : 0x1_0b, optional);
    bytes.writeUInt32LE(4096, optional + 32);
    bytes.writeUInt32LE(512, optional + 36);
    bytes.writeUInt32LE(8192, optional + 56);
    bytes.writeUInt32LE(512, optional + 60);
    const directories = optional + (is64 ? 112 : 96);
    bytes.writeUInt32LE(4096, directories + 16);
    bytes.writeUInt32LE(2048, directories + 20);
    const section = optional + (is64 ? 240 : 224);
    bytes.write('.rsrc', section);
    bytes.writeUInt32LE(2048, section + 8);
    bytes.writeUInt32LE(4096, section + 12);
    bytes.writeUInt32LE(2048, section + 16);
    bytes.writeUInt32LE(512, section + 20);
    bytes.writeUInt16LE(1, 512 + 14);
    bytes.writeUInt32LE(10, 512 + 16);
    bytes.writeUInt32LE(0x80_00_00_00 + 24, 512 + 20);
    bytes.writeUInt16LE(3, 512 + 24 + 12);
    let nameOffset = 184;
    let dataOffset = 512;
    const resources: [string, Buffer][] = [
        ['UV_PYTHON_PATH', Buffer.from(interpreter)],
        ['UV_SCRIPT_DATA', Buffer.from('PK\u0003\u0004embedded script\u0000\u00FF', 'latin1')],
        ['UV_TRAMPOLINE_KIND', Buffer.from([kind])],
    ];
    for (const [index, [name, content]] of resources.entries()) {
        const encoded = Buffer.from(name, 'utf16le');
        bytes.writeUInt16LE(encoded.length / 2, 512 + nameOffset);
        encoded.copy(bytes, 512 + nameOffset + 2);
        bytes.writeUInt32LE(0x80_00_00_00 + nameOffset, 512 + 40 + index * 8);
        bytes.writeUInt32LE(0x80_00_00_00 + 64 + index * 24, 512 + 44 + index * 8);
        bytes.writeUInt16LE(1, 512 + 64 + index * 24 + 14);
        bytes.writeUInt32LE(136 + index * 16, 512 + 64 + index * 24 + 20);
        bytes.writeUInt32LE(4096 + dataOffset, 512 + 136 + index * 16);
        bytes.writeUInt32LE(content.length, 512 + 140 + index * 16);
        content.copy(bytes, 512 + dataOffset);
        dataOffset += content.length;
        nameOffset += 2 + encoded.length;
    }
    return bytes;
}

const INTERPRETERS = new Map([
    [
        String.raw`C:\working project\.venv\Scripts\python.exe`,
        String.raw`C:\selected revision\.venv\Scripts\python.exe`,
    ],
]);

test.each([false, true])('uv launcher relocation preserves resource payloads in PE64=%s', (is64) => {
    const original = launcher(is64);
    const retained = Buffer.from(original);
    const relocated = relocateWindowsLauncher(original, INTERPRETERS, new Set())!;
    expect(original).toStrictEqual(retained);
    expect(relocated.readUInt16LE(134)).toBe(2);
    const added = 152 + (is64 ? 240 : 224) + 40;
    const address = relocated.readUInt32LE(added + 12);
    const offset = relocated.readUInt32LE(added + 20);
    const size = relocated.readUInt32LE(added + 8);
    expect(relocated.readUInt32LE(512 + 136)).toBe(address);
    expect(relocated.readUInt32LE(512 + 140)).toBe(size);
    expect(relocated.subarray(offset, offset + size).toString('utf8')).toBe([...INTERPRETERS.values()][0]!);
    expect(relocated.subarray(512 + 144, original.length)).toStrictEqual(original.subarray(512 + 144));
    expect(relocated.readUInt32LE(added + 36)).toBe(0x40_00_00_40);
});

test('uv interpreter trampolines retain their declared host interpreter', () => {
    expect(
        relocateWindowsLauncher(
            launcher(true, 2, String.raw`C:\Python\python.exe`),
            INTERPRETERS,
            new Set([String.raw`C:\Python\python.exe`]),
        ),
    ).toBeUndefined();
});

test('uv script relocation rejects an interpreter outside its installed environment', () => {
    expect(() => relocateWindowsLauncher(launcher(true), new Map(), new Set())).toThrow('Cannot relocate');
});

test('uv launcher relocation refuses signed images and insufficient section-header space', () => {
    const signed = launcher(true);
    signed.writeUInt32LE(2500, 152 + 112 + 32);
    expect(() => relocateWindowsLauncher(signed, INTERPRETERS, new Set())).toThrow('Cannot relocate');
    const crowded = launcher(true);
    crowded.writeUInt32LE(440, 152 + 60);
    expect(() => relocateWindowsLauncher(crowded, INTERPRETERS, new Set())).toThrow('Cannot relocate');
});

test('revision snapshots relocate uv PE resources and retain the working launcher', async () => {
    await using repository = await testdir();
    await using host = await testdir();
    const root = repository.path;
    const original = launcher(true, 1, join(root, '.venv/Scripts/python.exe'));
    const hostPath = join(host.path, 'python.exe');
    await createFileTree(host.path, { 'python.exe': 'Declared native host interpreter' });
    const interpreter = launcher(true, 2, relative(join(root, '.venv/Scripts'), hostPath));
    await createFileTree(root, {
        '.gitignore': '.venv/\n',
        'pyproject.toml': '[project]\nname = "fixture"\nversion = "0.0.0"\n',
        'uv.lock': 'version = 1\n',
        '.venv/pyvenv.cfg': `home = ${host.path}\nversion = 3.12.2\ninclude-system-site-packages = false\n`,
        '.venv/Scripts/python.exe': interpreter,
        '.venv/Scripts/check.exe': original,
    });
    for (const command of [
        ['git', 'init', '-q'],
        ['git', 'add', '.'],
    ]) {
        const result = await run(command, { cwd: root });
        expect(result.code, result.stderr).toBe(0);
    }
    await withRevisionSnapshot(root, { kind: 'index' }, async (snapshot) => {
        const bytes = readFileSync(join(snapshot, '.venv/Scripts/check.exe'));
        const section = 152 + 240 + 40;
        const offset = bytes.readUInt32LE(section + 20);
        const size = bytes.readUInt32LE(section + 8);
        expect(bytes.subarray(offset, offset + size).toString('utf8')).toBe(join(snapshot, '.venv/Scripts/python.exe'));
        expect(bytes.subarray(512 + 144, original.length)).toStrictEqual(original.subarray(512 + 144));
        const python = readFileSync(join(snapshot, '.venv/Scripts/python.exe'));
        const hostOffset = python.readUInt32LE(section + 20);
        const hostSize = python.readUInt32LE(section + 8);
        expect(python.subarray(hostOffset, hostOffset + hostSize).toString('utf8')).toBe(hostPath);
    });
    expect(readFileSync(join(root, '.venv/Scripts/check.exe'))).toStrictEqual(original);
    expect(readFileSync(join(root, '.venv/Scripts/python.exe'))).toStrictEqual(interpreter);
    expect(readFileSync(hostPath, 'utf8')).toBe('Declared native host interpreter');
});

test.each(['python.exe', String.raw`.\PYTHON.EXE`, String.raw`..\Scripts\python.exe`])(
    'uv script relative interpreter %s resolves against its launcher directory',
    (path) => {
        const relocated = relocateWindowsLauncher(launcher(true, 1, path), INTERPRETERS, new Set())!;
        const section = 152 + 240 + 40;
        const offset = relocated.readUInt32LE(section + 20);
        const size = relocated.readUInt32LE(section + 8);
        expect(relocated.subarray(offset, offset + size).toString('utf8')).toBe([...INTERPRETERS.values()][0]!);
    },
);

test.each([String.raw`..\..\outside\python.exe`, 'C:python.exe', String.raw`\python.exe`])(
    'uv script relative interpreter %s cannot escape the declared environment',
    (path) => {
        expect(() => relocateWindowsLauncher(launcher(true, 1, path), INTERPRETERS, new Set())).toThrow(
            'Cannot relocate',
        );
    },
);

test('relative uv host interpreters relocate only to declared host executables', () => {
    const host = String.raw`C:\Python\python.exe`;
    const original = launcher(true, 2, String.raw`..\..\..\Python\python.exe`);
    const relocated = relocateWindowsLauncher(original, INTERPRETERS, new Set([host]))!;
    const section = 152 + 240 + 40;
    const offset = relocated.readUInt32LE(section + 20);
    const size = relocated.readUInt32LE(section + 8);
    expect(relocated.subarray(offset, offset + size).toString('utf8')).toBe(host);
    expect(() =>
        relocateWindowsLauncher(original, INTERPRETERS, new Set([String.raw`C:\Elsewhere\python.exe`])),
    ).toThrow('Cannot relocate');
});
