import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { settingsText } from '#tests/setup/settings.ts';
import { checkFindings } from '#tests/setup/check-input.ts';
import { SHOWN_FUNCTION } from '#tests/config/python/docstrings.ts';
import { EXPORT_ORDER_FILES } from '#tests/config/python/imports.ts';
import { PYTHON_MODULE_HEADER } from '#tests/config/python/modules.ts';

test('a function left out of __all__ carries the private prefix', async () => {
    await using sandbox = await testdir({
        'gspot.toml': settingsText(['python'], { level: 'all' }),
        'example/leaky.py': `${PYTHON_MODULE_HEADER}${SHOWN_FUNCTION}\n\ndef hidden() -> int:\n    """Give two."""\n    return 2\n\n\n__all__ = ["shown"]\n`,
        'example/tidy.py': `${PYTHON_MODULE_HEADER}${SHOWN_FUNCTION}\n\ndef _hidden() -> int:\n    """Give two."""\n    return 2\n\n\n__all__ = ["shown"]\n`,
    });
    expect(await checkFindings(sandbox.path, 'python/private-prefix')).toMatchObject([
        { file: 'example/leaky.py', line: 9, rule: 'private-prefix' },
    ]);
});

test('__all__ belongs at the bottom, lists shortest names first, and stays under the package limit', async () => {
    await using sandbox = await testdir({
        'gspot.toml': settingsText(['python'], { level: 'all' }),
        ...EXPORT_ORDER_FILES,
    });
    expect(await checkFindings(sandbox.path, 'python/exports-at-bottom')).toMatchObject([
        { file: 'example/top.py', line: 4, rule: 'exports-at-bottom' },
    ]);
    expect(await checkFindings(sandbox.path, 'python/export-order')).toMatchObject([
        { file: 'example/listed.py', line: 14, rule: 'export-order' },
    ]);
    await Bun.write(
        `${sandbox.path}/gspot.toml`,
        settingsText(['python'], { level: 'all', tables: '[limits]\nindex_exports = 2\n' }),
    );
    expect(await checkFindings(sandbox.path, 'python/package-exports')).toMatchObject([
        { file: 'example/__init__.py', line: 4, rule: 'package-exports' },
    ]);
    await Bun.write(
        `${sandbox.path}/gspot.toml`,
        settingsText(['python'], { level: 'all', tables: '[limits]\nindex_exports = 3\n' }),
    );
    expect(await checkFindings(sandbox.path, 'python/package-exports')).toStrictEqual([]);
});

test('__all__ names in shortest-first order pass export ordering', async () => {
    await using sandbox = await testdir({
        'gspot.toml': settingsText(['python'], { level: 'all' }),
        'example/sorted.py': `${PYTHON_MODULE_HEADER}${SHOWN_FUNCTION}\n\ndef ab() -> int:\n    """Give two."""\n    return 2\n\n\n__all__ = ["ab", "shown"]\n`,
    });
    expect(await checkFindings(sandbox.path, 'python/export-order')).toStrictEqual([]);
});
