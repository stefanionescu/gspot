import { test, expect } from 'bun:test';
import { docstringStyle } from '#cli/checks/python/docstrings.ts';

test.each(['google', 'numpy'] as const)('Ruff %s docstrings keep into an unconfigured pydoclint style', (style) => {
    const project = `[tool.ruff.lint.pydocstyle]\nconvention = "${style}"\n`;
    expect(docstringStyle(project)).toBe(style);
    expect(docstringStyle(`${project}[tool.pydoclint]\nskip-checking-raises = true\n`)).toBe(style);
    expect(docstringStyle(`${project}[tool.pydoclint]\nstyle = "sphinx"\n`)).toBeUndefined();
});

test('absent and unsupported Ruff conventions preserve native defaults', () => {
    for (const text of ['', '[tool.ruff]\nline-length = 88\n', '[tool.ruff.lint.pydocstyle]\nconvention = "pep257"\n'])
        expect(docstringStyle(text)).toBeUndefined();
    expect(() => docstringStyle('[tool.ruff')).toThrow();
});
