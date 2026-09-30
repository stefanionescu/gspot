// The Python import analyses: cycles, module singletons, and comments between imports.
import { test, expect } from 'bun:test';
import { freeModules, pythonModulesOf } from '#tests/support/cli/python/modules.ts';
import { singletons, importCycles, importComments } from '#cli/checks/python/imports.ts';

const HEAD = '"""A planted module."""\n\n\n';

test('two modules that import each other are one cycle, reported at the first file', async () => {
    const modules = await pythonModulesOf({
        'planted/left.py': `${HEAD}from planted import right\n\nVALUE = right\n`,
        'planted/right.py': `${HEAD}from planted import left\n\nVALUE = left\n`,
        'planted/alone.py': `${HEAD}import os\n\nVALUE = os.sep\n`,
    });
    try {
        expect(importCycles(modules).map(({ file, line, rule }) => ({ file, line, rule }))).toStrictEqual([
            { file: 'planted/left.py', line: 1, rule: 'import-cycle' },
        ]);
    } finally {
        freeModules(modules);
    }
});

test('a module-level instance is a singleton unless its name is allowed', async () => {
    const modules = await pythonModulesOf({
        'planted/shared.py': `${HEAD}class Store:\n    """Holds things."""\n\n\nstore = Store()\n`,
    });
    try {
        expect(singletons(modules, new Set()).map(({ file, line, rule }) => ({ file, line, rule }))).toStrictEqual([
            { file: 'planted/shared.py', line: 8, rule: 'no-singletons' },
        ]);
        expect(singletons(modules, new Set(['store']))).toStrictEqual([]);
    } finally {
        freeModules(modules);
    }
});

test('a comment between imports is reported at its line, and imports without one are clean', async () => {
    const modules = await pythonModulesOf({
        'planted/noted.py':
            '"""A planted module."""\n\nimport os\n# the path tools\nimport sys\n\nVALUE = [os.sep, sys.prefix]\n',
        'planted/plain.py': '"""A planted module."""\n\nimport os\nimport sys\n\nVALUE = [os.sep, sys.prefix]\n',
    });
    try {
        expect(importComments(modules).map(({ file, line, rule }) => ({ file, line, rule }))).toStrictEqual([
            { file: 'planted/noted.py', line: 4, rule: 'import-comment' },
        ]);
    } finally {
        freeModules(modules);
    }
});
