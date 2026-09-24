import { join } from 'node:path';
import { planRun } from '#cli/run/plan.ts';
import { describe, expect, test } from 'bun:test';
import { engineInput } from '#cli/run/engines.ts';
import { openSession } from '#cli/run/session.ts';
import { createFileTree, testdir } from 'testdirs';
import { astGrepMatches } from '#cli/structure/ast-grep.ts';
import { readOwnership } from '#cli/lifecycle/ownership.ts';
import { xcodeProposal } from '#cli/commands/init/xcode.ts';
import { fileMode, mutationPath, openConfinedRoot } from '#cli/platform/filesystem.ts';

import {
    linkSync,
    readFileSync,
    statSync,
    symlinkSync,
    existsSync,
    unlinkSync,
    chmodSync,
    writeFileSync,
} from 'node:fs';

test('native replacement and removal preserve read-only identities', async () => {
    await using directory = await testdir();
    const root = openConfinedRoot(directory.path);
    const original = { bytes: Buffer.from([0, 255, 10]), mode: fileMode({ mode: 0o444 }) };
    const replacement = { bytes: Buffer.from('replacement'), mode: fileMode({ mode: 0o644 }) };
    try {
        root.write('config/input', original, undefined);
        expect(root.read('config/input')).toStrictEqual(original);
        root.write('config/input', replacement, original);
        expect(root.read('config/input')).toStrictEqual(replacement);
        root.write('config/input', original, replacement);
        expect(() => {
            root.remove('config/input', replacement);
        }).toThrow('changed');
        expect(root.read('config/input')).toStrictEqual(original);
        root.remove('config/input', original);
        expect(root.read('config/input')).toBeUndefined();
    } finally {
        root.close();
    }
});

describe.skipIf(process.platform === 'win32')('confined lifecycle mutations', () => {
    test.each(['project', 'configuration', 'schemes'] as const)(
        'Xcode discovery rejects a symlinked %s and leaves outside data unchanged',
        async (kind) => {
            await using directory = await testdir();
            await createFileTree(directory.path, {
                'project/app.xcodeproj/.keep': '',
                'outside/schemes/Main.xcscheme': 'authored scheme',
                'outside/periphery.yml': 'schemes:\n  - Authored\n',
            });
            const root = join(directory.path, 'project');
            if (kind === 'project') symlinkSync('../outside', join(root, 'aaa.xcodeproj'));
            if (kind === 'configuration') symlinkSync('../outside/periphery.yml', join(root, '.periphery.yml'));
            if (kind === 'schemes') symlinkSync('../../outside', join(root, 'app.xcodeproj/xcshareddata'));
            expect(() => xcodeProposal(root, [''])).toThrow(/(?:Unsafe lifecycle|Lifecycle destination)/u);
            expect(readFileSync(join(directory.path, 'outside/periphery.yml'), 'utf8')).toBe(
                'schemes:\n  - Authored\n',
            );
            expect(readFileSync(join(directory.path, 'outside/schemes/Main.xcscheme'), 'utf8')).toBe('authored scheme');
            expect(existsSync(join(root, '.gspot'))).toBe(false);
        },
    );

    test('replacements preserve expected bytes and modes and refuse subsequent edits', async () => {
        await using directory = await testdir();
        const root = openConfinedRoot(directory.path);
        try {
            const original = { bytes: Buffer.from([0, 255, 10]), mode: 0o640 };
            root.write('config/input', original, undefined);
            expect(root.read('config/input')).toStrictEqual(original);
            const next = { bytes: Buffer.from('replacement\n'), mode: 0o444 };
            root.write('config/input', next, original);
            expect(root.read('config/input')).toStrictEqual(next);
            expect(() => {
                root.write('config/input', original, original);
            }).toThrow('changed');
            expect(() => {
                root.remove('config/input', original);
            }).toThrow('changed');
            expect(root.read('config/input')).toStrictEqual(next);
            root.remove('config/input', next);
            expect(root.read('config/input')).toBeUndefined();
        } finally {
            root.close();
        }
    });

    test.each(['portable', 'native'] as const)(
        '%s paths cannot use symlinks or hardlinks to change an external file',
        async (format) => {
            await using directory = await testdir();
            await createFileTree(directory.path, { 'project/.keep': '', 'outside/sentinel': 'authored\n' });
            const outside = join(directory.path, 'outside');
            const project = join(directory.path, 'project');
            symlinkSync(outside, join(project, 'escape'));
            symlinkSync(join(outside, 'sentinel'), join(project, 'linked'));
            linkSync(join(outside, 'sentinel'), join(project, 'hardlinked'));
            const root = openConfinedRoot(project, format);
            try {
                for (const path of ['escape/sentinel', 'linked', 'hardlinked']) {
                    expect(() => {
                        root.write(path, { bytes: Buffer.from('lost'), mode: 0o600 }, undefined);
                    }).toThrow();
                    expect(() => {
                        root.remove(path, { bytes: Buffer.from('authored\n'), mode: 0o644 });
                    }).toThrow();
                    expect(readFileSync(join(outside, 'sentinel'), 'utf8')).toBe('authored\n');
                }
                root.mkdir('.gspot/state/recovery', 0o700);
                expect(statSync(join(project, '.gspot/state/recovery')).mode & 0o777).toBe(0o700);
            } finally {
                root.close();
            }
        },
    );

    test('native snapshot names retain POSIX bytes while refusing traversal and private links', async () => {
        await using directory = await testdir();
        const root = openConfinedRoot(directory.path, 'native');
        const path = 'folder/a\n"é:?.txt';
        const original = { bytes: Buffer.from('inside'), mode: 0o640 };
        try {
            root.write(path, original, undefined);
            expect(root.read(path)).toStrictEqual(original);
            expect(() => mutationPath(path)).toThrow('Unsafe lifecycle path');
            const link = { bytes: Buffer.from(path), mode: 0o777, isLink: true as const };
            root.write('linked', link, undefined);
            expect(root.readEntry('linked')).toStrictEqual(link);
            for (const unsafe of ['../outside', '/outside', 'folder/../outside', 'nul\0suffix']) {
                expect(() => {
                    root.write(unsafe, original, undefined);
                }).toThrow('Unsafe lifecycle path');
            }
            expect(() => {
                root.write('private-link', { ...link, bytes: Buffer.from('.gspot/state/ownership.json') }, undefined);
            }).toThrow('Lifecycle metadata');
        } finally {
            root.close();
        }
    });

    test('link publication refuses escaped, private, missing, and symlinked targets', async () => {
        await using directory = await testdir();
        await createFileTree(directory.path, { 'project/target': 'inside', 'outside/sentinel': 'outside' });
        const project = join(directory.path, 'project');
        symlinkSync('../outside', join(project, 'escape'));
        symlinkSync('../outside/sentinel', join(project, 'escaped-file'));
        const root = openConfinedRoot(project);
        try {
            for (const target of [
                '../outside/sentinel',
                '/etc/passwd',
                'escape/sentinel',
                'escaped-file',
                'escape/../target',
                '.gspot/state/ownership.json',
                'missing',
                'target\u0000outside',
                String.raw`C:\outside`,
            ]) {
                expect(() => {
                    root.write('tool', { bytes: Buffer.from(target), mode: 0o777, isLink: true }, undefined);
                }).toThrow();
                expect(root.read('tool')).toBeUndefined();
                expect(readFileSync(join(directory.path, 'outside/sentinel'), 'utf8')).toBe('outside');
            }
            const next = { bytes: Buffer.from('target'), mode: 0o777, isLink: true as const };
            root.write('tool', next, undefined);
            expect(root.readEntry('tool')).toStrictEqual(next);
            expect(readFileSync(join(project, 'tool'), 'utf8')).toBe('inside');
            root.remove('tool', next);
            expect(root.read('tool')).toBeUndefined();
            expect(readFileSync(join(project, 'target'), 'utf8')).toBe('inside');
        } finally {
            root.close();
        }
    });

    test('a second writer is refused until the first releases its lock', async () => {
        await using directory = await testdir();
        const first = openConfinedRoot(directory.path);
        const second = openConfinedRoot(directory.path);
        try {
            first.lock('.gspot/mutation.lock');
            expect(() => {
                second.lock('.gspot/mutation.lock');
            }).toThrow('Another lifecycle writer');
            first.close();
            expect(() => {
                second.lock('.gspot/mutation.lock');
            }).not.toThrow();
        } finally {
            first.close();
            second.close();
        }
    });
});

test('mutation paths reject portable escapes and preserve ordinary Unicode names', () => {
    for (const path of [
        '../outside',
        '/outside',
        'a/../b',
        'a//b',
        'a/./b',
        'C:relative',
        'C:/absolute',
        String.raw`\\server\share`,
        String.raw`a\b`,
        'nul.txt',
        'a/COM1',
        'a.',
        'a ',
        'a\0b',
        '',
    ]) {
        expect(() => mutationPath(path)).toThrow('Unsafe lifecycle path');
    }
    expect(mutationPath('documents/équipe 50%.md')).toStrictEqual(['documents', 'équipe 50%.md']);
});

test('Windows file identities retain read-only changes without inventing POSIX permissions', () => {
    const writable = [0o600, 0o640, 0o644, 0o755, 0o777];
    const readonly = [0o400, 0o440, 0o444, 0o555];
    const writableModes = writable.map((mode) => fileMode({ mode }, 'win32'));
    const readonlyModes = readonly.map((mode) => fileMode({ mode }, 'win32'));
    expect(new Set(writableModes).size).toBe(1);
    expect(new Set(readonlyModes).size).toBe(1);
    expect(writableModes[0]).not.toBe(readonlyModes[0]);
    for (const mode of [...writable, ...readonly]) {
        expect(fileMode({ mode }, 'darwin')).toBe(mode);
        expect(fileMode({ mode }, 'linux')).toBe(mode);
        expect(fileMode({ mode: fileMode({ mode }, 'win32') }, 'win32')).toBe(fileMode({ mode }, 'win32'));
        expect(fileMode({ mode, isLink: true }, 'win32')).toBe(writableModes[0]!);
    }
});

test('structural rule caching confines writes and preserves later rule edits', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'project/gspot.toml': 'version = 1\nlevel = "all"\nconfigurations = ["bash"]\n[runner]\ntool = "mise"\n',
        'project/example.sh': 'if true; then echo yes; fi\n',
        'project/.gspot/.keep': '',
        'outside/ast-grep/bash-branches.yml': 'external rule\n',
    });
    const root = join(directory.path, 'project');
    const cache = join(root, '.gspot/cache');
    const session = await openSession(root);
    const [planned] = await planRun(session, { stage: 'commit', skips: [], only: ['structure/bash-branches'] });
    const input = engineInput(session, planned!);
    symlinkSync('../../outside', cache);
    const run = () =>
        astGrepMatches(input, 'packages/cli/configurations/language/bash/rules/bash-branches.yml', ['example.sh']);
    await expect(run()).rejects.toThrow('Unsafe lifecycle parent');
    expect(readFileSync(join(directory.path, 'outside/ast-grep/bash-branches.yml'), 'utf8')).toBe('external rule\n');
    unlinkSync(cache);
    expect(await run()).toHaveLength(1);
    expect(await run()).toHaveLength(1);
    const rule = '.gspot/cache/ast-grep/bash-branches.yml';
    expect(readOwnership(root).files.find((entry) => entry.path === rule)?.kind).toBe('runtime');
    chmodSync(join(root, rule), 0o644);
    writeFileSync(join(root, rule), 'edited rule\n');
    await expect(run()).rejects.toThrow(`Retained edited or unowned structural rule: ${rule}`);
    expect(readFileSync(join(root, rule), 'utf8')).toBe('edited rule\n');
});

test('empty-directory removal confines parents and preserves nonempty directories', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'project/.keep': '', 'outside/kept/value': 'external' });
    const root = join(sandbox.path, 'project');
    symlinkSync('../outside', join(root, 'linked'));
    const files = openConfinedRoot(root);
    try {
        expect(() => {
            files.rmdir('linked/kept');
        }).toThrow('Unsafe lifecycle parent');
        expect(() => {
            files.rmdir('../outside/kept');
        }).toThrow('Unsafe lifecycle path');
        files.mkdir('cache/empty', 0o700);
        files.rmdir('cache/empty');
        expect(files.stat('cache/empty')).toBeUndefined();
        files.write('cache/kept/value', { bytes: Buffer.from('retained'), mode: 0o600 }, undefined);
        expect(() => {
            files.rmdir('cache/kept');
        }).toThrow();
        expect(files.read('cache/kept/value')?.bytes.toString()).toBe('retained');
        expect(readFileSync(join(sandbox.path, 'outside/kept/value'), 'utf8')).toBe('external');
    } finally {
        files.close();
    }
});

test.each([
    'schemes: ["Authored # scheme"]\n',
    'schemes:\n  # Preserve the selected scheme.\n  - "Authored # scheme"\n',
    'schemes: &schemes\n  - "Authored # scheme"\nretain_public: true\n',
])('Xcode discovery reads YAML scheme syntax: %s', async (configuration) => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'app.xcodeproj/xcshareddata/xcschemes/Fallback.xcscheme': '',
        '.periphery.yml': configuration,
    });
    expect(xcodeProposal(directory.path, [''])).toStrictEqual({
        scope: '',
        project: 'app.xcodeproj',
        scheme: 'Authored # scheme',
    });
});

test('Xcode discovery rejects invalid scheme settings and accepts their correction', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'app.xcodeproj/xcshareddata/xcschemes/Fallback.xcscheme': '',
        '.periphery.yml': 'schemes: [42]\n',
    });
    expect(() => xcodeProposal(directory.path, [''])).toThrow();
    writeFileSync(join(directory.path, '.periphery.yml'), 'schemes: []\n');
    expect(xcodeProposal(directory.path, [''])).toStrictEqual({
        scope: '',
        project: 'app.xcodeproj',
        scheme: 'Fallback',
    });
});
