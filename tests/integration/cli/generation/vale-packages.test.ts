import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { unlinkSync, symlinkSync, readFileSync } from 'node:fs';
import { hasPackages, removePackages } from '#cli/tools/vale.ts';

const CONFIG = 'StylesPath = vale/styles\nPackages = LocalStyle\n';

// A repository whose Vale configuration, package, or nested package folder links to a folder beside it.
async function linkedStyles(directory: string, kind: string): Promise<string> {
    await createFileTree(directory, {
        'project/.gspot/config/vale.ini': CONFIG,
        'project/.gspot/config/vale/styles/.keep': '',
        'outside/vale.ini': CONFIG,
        'outside/terms.yml': 'external bytes\n',
    });
    const root = join(directory, 'project');
    if (kind === 'configuration') {
        unlinkSync(join(root, '.gspot/config/vale.ini'));
        symlinkSync('../../outside/vale.ini', join(root, '.gspot/config/vale.ini'));
    } else if (kind === 'package') {
        symlinkSync('../../../../outside', join(root, '.gspot/config/vale/styles/LocalStyle'));
    } else {
        await createFileTree(root, { '.gspot/config/vale/styles/LocalStyle/.keep': '' });
        symlinkSync('../../../../../outside', join(root, '.gspot/config/vale/styles/LocalStyle/nested'));
    }
    return root;
}

test.each(['configuration', 'package'])(
    'Vale package detection rejects a linked %s without reading outside styles',
    async (kind) => {
        await using directory = await testdir();
        const root = await linkedStyles(directory.path, kind);
        expect(() => hasPackages(root)).toThrow(/lifecycle/iu);
        expect(readFileSync(join(directory.path, 'outside/terms.yml'), 'utf8')).toBe('external bytes\n');
        expect(readFileSync(join(directory.path, 'outside/vale.ini'), 'utf8')).toBe(CONFIG);
    },
);

test.each(['package', 'nested directory'])(
    'Vale package removal refuses a linked %s without deleting outside styles',
    async (kind) => {
        await using directory = await testdir();
        const root = await linkedStyles(directory.path, kind);
        expect(() => {
            removePackages(root);
        }).toThrow(/lifecycle/iu);
        expect(readFileSync(join(directory.path, 'outside/terms.yml'), 'utf8')).toBe('external bytes\n');
    },
);
