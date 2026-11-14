import { test, expect } from 'bun:test';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { assertCheckSample } from '#tests/setup/cli/samples.ts';
import { createSandbox } from '#tests/setup/sandboxes/create.ts';
import { GOOGLE_PYPROJECT } from '#tests/config/setup/languages.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { PLACEHOLDER_DOCSTRING_CASES } from '#tests/config/configurations/python.ts';

const CLEAN_PYTHON_MODULE = `"""Prices."""


def _rounded(amount: float) -> float:
    """Round to cents, half up."""
    shifted = amount * 100
    whole = int(shifted + 0.5)
    return whole / 100


def total(prices: list[float]) -> float:
    """Add prices and round the sum."""
    summed = sum(prices)
    checked = max(summed, 0.0)
    return _rounded(checked) + _rounded(0.0)


__all__ = ["total"]
`;

const PYTHON_MODULE_SANDBOX = {
    configurations: ['python'],
    cleanSource: CLEAN_PYTHON_MODULE,
    files: {
        'pyproject.toml': GOOGLE_PYPROJECT,
        'example/__init__.py': '"""The test package."""\n',
        'example/prices.py': CLEAN_PYTHON_MODULE,
    },
} as const;

test.each([...PLACEHOLDER_DOCSTRING_CASES])(
    '$check reports $expected.rule in $expected.file and passes after the fix',
    async (sample) => {
        await using sandbox = await createSandbox(PYTHON_MODULE_SANDBOX);
        await assertCheckSample(sandbox, sample, PYTHON_MODULE_SANDBOX.cleanSource);
    },
);

test.each<{ docstring: string; lines: number[] }>([
    { docstring: 'Class that holds an order.', lines: [1] },
    { docstring: 'Class for orders.', lines: [1] },
    { docstring: 'A class of orders.', lines: [1] },
    { docstring: 'Classifies orders by region.', lines: [] },
    { docstring: 'TODO', lines: [1] },
    { docstring: '...', lines: [1] },
])(
    'python/placeholder-docstrings reports the class docstring $docstring on lines $lines',
    async ({ docstring, lines }) => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings(['python'], { level: 'all' }),
            'model.py': `class Order:\n    """${docstring}"""\n`,
        });
        const findings = await runSandboxCheck(sandbox.path, 'python/placeholder-docstrings');
        expect(findings.map(({ line }) => line)).toStrictEqual(lines);
    },
);
