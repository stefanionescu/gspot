import { join } from 'node:path';
import { expect, test } from 'bun:test';

import { createFileTree, testdir } from 'testdirs';

import { hasPackages } from '#cli/prose/vale.ts';

import { readFileSync, symlinkSync, unlinkSync } from 'node:fs';

test.each(['configuration', 'package', 'nested directory'])(
    'Vale package detection rejects a linked %s without reading outside styles',
    async (kind) => {
        await using directory = await testdir();
        const config = 'StylesPath = vale/styles\nPackages = LocalStyle\n';
        await createFileTree(directory.path, {
            'project/.gspot/config/vale.ini': config,
            'project/.gspot/config/vale/styles/.keep': '',
            'outside/vale.ini': config,
            'outside/terms.yml': 'external bytes\n',
        });
        const root = join(directory.path, 'project');
        if (kind === 'configuration') {
            unlinkSync(join(root, '.gspot/config/vale.ini'));
            symlinkSync('../../outside/vale.ini', join(root, '.gspot/config/vale.ini'));
        } else if (kind === 'package') {
            symlinkSync('../../../../outside', join(root, '.gspot/config/vale/styles/LocalStyle'));
        } else {
            await createFileTree(root, { '.gspot/config/vale/styles/LocalStyle/.keep': '' });
            symlinkSync('../../../../../outside', join(root, '.gspot/config/vale/styles/LocalStyle/nested'));
        }
        expect(() => hasPackages(root, true)).toThrow(/lifecycle/iu);
        expect(readFileSync(join(directory.path, 'outside/terms.yml'), 'utf8')).toBe('external bytes\n');
        expect(readFileSync(join(directory.path, 'outside/vale.ini'), 'utf8')).toBe(config);
    },
);
