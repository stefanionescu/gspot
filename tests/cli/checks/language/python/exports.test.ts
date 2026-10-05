// The Python export analyses: private prefixes, declaration order, the place and order of __all__, and its size.
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/execution/session.ts';
import { buildEngineInput } from '#tests/harness/input.ts';
import { SHOWN } from '#tests/config/cli/checks/language/python/exports.ts';
import { PYTHON_MODULE_HEADER } from '#tests/config/samples/python/source.ts';

import {
    exportOrder,
    privatePrefix,
    packageExports,
    exportsAtBottom,
    privateBeforePublic,
} from '#cli/checks/language/python/exports.ts';

test('a function left out of __all__ carries the private prefix', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildPolicy(['python'], { level: 'all' }),
        'example/leaky.py': `${PYTHON_MODULE_HEADER}${SHOWN}\n\ndef hidden() -> int:\n    """Give two."""\n    return 2\n\n\n__all__ = ["shown"]\n`,
        'example/tidy.py': `${PYTHON_MODULE_HEADER}${SHOWN}\n\ndef _hidden() -> int:\n    """Give two."""\n    return 2\n\n\n__all__ = ["shown"]\n`,
    });
    expect(
        await privatePrefix(buildEngineInput(await openSession(sandbox.path), 'python/private-prefix')),
    ).toMatchObject([{ file: 'example/leaky.py', line: 9, rule: 'private-prefix' }]);
});

test('a private function declared under a public one is reported while private declarations above it pass', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildPolicy(['python'], { level: 'all' }),
        'example/tidy.py': `${PYTHON_MODULE_HEADER}def _part() -> int:\n    """Give one part."""\n    return 1\n\n\ndef shown() -> int:\n    """Give one."""\n    return _part()\n`,
        'example/order.py': `${PYTHON_MODULE_HEADER}def shown() -> int:\n    """Give one."""\n    return _part()\n\n\ndef _part() -> int:\n    """Give one part."""\n    return 1\n`,
    });
    expect(
        await privateBeforePublic(buildEngineInput(await openSession(sandbox.path), 'python/private-before-public')),
    ).toMatchObject([{ file: 'example/order.py', line: 9, rule: 'private-before-public' }]);
});

test('__all__ belongs at the bottom, lists shortest names first, and stays under the package ceiling', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildPolicy(['python'], { level: 'all' }),
        'example/top.py': `${PYTHON_MODULE_HEADER}__all__ = ["shown"]\n\n\n${SHOWN}`,
        'example/listed.py': `${PYTHON_MODULE_HEADER}${SHOWN}\n\ndef ab() -> int:\n    """Give two."""\n    return 2\n\n\n__all__ = ["shown", "ab"]\n`,
        'example/__init__.py': `${PYTHON_MODULE_HEADER}__all__ = ["a", "b", "c"]\n`,
    });
    expect(
        await exportsAtBottom(buildEngineInput(await openSession(sandbox.path), 'python/exports-at-bottom')),
    ).toMatchObject([{ file: 'example/top.py', line: 4, rule: 'exports-at-bottom' }]);
    expect(await exportOrder(buildEngineInput(await openSession(sandbox.path), 'python/export-order'))).toMatchObject([
        { file: 'example/listed.py', line: 14, rule: 'export-order' },
    ]);
    await Bun.write(
        `${sandbox.path}/gspot.toml`,
        buildPolicy(['python'], { level: 'all', tables: '[limits.python]\npackage_exports = 2\n' }),
    );
    expect(
        await packageExports(buildEngineInput(await openSession(sandbox.path), 'python/package-exports')),
    ).toMatchObject([{ file: 'example/__init__.py', line: 4, rule: 'package-exports' }]);
    await Bun.write(
        `${sandbox.path}/gspot.toml`,
        buildPolicy(['python'], { level: 'all', tables: '[limits.python]\npackage_exports = 3\n' }),
    );
    expect(
        await packageExports(buildEngineInput(await openSession(sandbox.path), 'python/package-exports')),
    ).toStrictEqual([]);
});

test('__all__ names in shortest-first order pass export ordering', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildPolicy(['python'], { level: 'all' }),
        'example/sorted.py': `${PYTHON_MODULE_HEADER}${SHOWN}\n\ndef ab() -> int:\n    """Give two."""\n    return 2\n\n\n__all__ = ["ab", "shown"]\n`,
    });
    expect(await exportOrder(buildEngineInput(await openSession(sandbox.path), 'python/export-order'))).toStrictEqual(
        [],
    );
});
