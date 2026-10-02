// The Python export analyses: private prefixes, declaration order, the place and order of __all__, and its size.
import { test, expect } from 'bun:test';
import { freeModules, pythonModulesOf } from '#tests/support/cli/python/modules.ts';

import {
    exportOrder,
    packageExports,
    exportsAtBottom,
    privatePrefixes,
    privateBeforePublic,
} from '#cli/checks/language/python/exports.ts';

const HEAD = '"""A planted module."""\n\n\n';
const SHOWN = 'def shown() -> int:\n    """Give one."""\n    return 1\n';
test('a function left out of __all__ carries the private prefix', async () => {
    const modules = await pythonModulesOf({
        'planted/leaky.py': `${HEAD}${SHOWN}\n\ndef hidden() -> int:\n    """Give two."""\n    return 2\n\n\n__all__ = ["shown"]\n`,
        'planted/tidy.py': `${HEAD}${SHOWN}\n\ndef _hidden() -> int:\n    """Give two."""\n    return 2\n\n\n__all__ = ["shown"]\n`,
    });
    try {
        expect(privatePrefixes(modules)).toMatchObject([{ file: 'planted/leaky.py', line: 9, rule: 'private-prefix' }]);
    } finally {
        freeModules(modules);
    }
});

test('a private function declared under a public one is reported at its line', async () => {
    const modules = await pythonModulesOf({
        'planted/order.py': `${HEAD}def shown() -> int:\n    """Give one."""\n    return _part()\n\n\ndef _part() -> int:\n    """Give one part."""\n    return 1\n`,
    });
    try {
        expect(privateBeforePublic(modules)).toMatchObject([
            { file: 'planted/order.py', line: 9, rule: 'private-before-public' },
        ]);
    } finally {
        freeModules(modules);
    }
});

test('__all__ belongs at the bottom, lists names in declaration order, and stays under the package ceiling', async () => {
    const modules = await pythonModulesOf({
        'planted/top.py': `${HEAD}__all__ = ["shown"]\n\n\n${SHOWN}`,
        'planted/listed.py': `${HEAD}${SHOWN}\n\ndef ab() -> int:\n    """Give two."""\n    return 2\n\n\n__all__ = ["shown", "ab"]\n`,
        'planted/__init__.py': `${HEAD}__all__ = ["a", "b", "c"]\n`,
    });
    try {
        expect(exportsAtBottom(modules)).toMatchObject([
            { file: 'planted/top.py', line: 4, rule: 'exports-at-bottom' },
        ]);
        expect(exportOrder(modules)).toMatchObject([{ file: 'planted/listed.py', line: 14, rule: 'export-order' }]);
        expect(packageExports(modules, 2)).toMatchObject([
            { file: 'planted/__init__.py', line: 4, rule: 'package-exports' },
        ]);
        expect(packageExports(modules, 3)).toStrictEqual([]);
    } finally {
        freeModules(modules);
    }
});
