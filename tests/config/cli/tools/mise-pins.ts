import type { ToolPin } from '#cli/types/parsers/tool.ts';
import { MISE_CONFIG_PATH, TOOL_PYTHON_PROJECT, TOOL_PACKAGE_PROJECT } from '#cli/config/platform/locations.ts';

export const DECLARED_TOOLS: ToolPin[] = [
    {
        name: 'eslint',
        kind: 'binary',
        version: '9.39.5',
        installers: { npm: { name: 'eslint', version: '9.39.5' } },
    },
    {
        name: 'ruff',
        kind: 'binary',
        version: '0.16.8',
        installers: { pypi: { name: 'ruff', version: '0.16.8' }, mise: { name: 'ruff', version: '0.16.8' } },
    },
    {
        name: 'vale',
        kind: 'binary',
        version: '3.21.0',
        installers: { mise: { name: 'vale', version: '3.21.0' } },
    },
    { name: 'docker', kind: 'binary', system: true, installers: {} },
];

export const DUPLICATE_CASES = [
    { runner: 'none', names: ['eslint', 'ruff'], files: [TOOL_PACKAGE_PROJECT, TOOL_PYTHON_PROJECT] },
    { runner: 'npm', names: ['eslint', 'ruff'], files: [TOOL_PACKAGE_PROJECT, TOOL_PYTHON_PROJECT] },
    { runner: undefined, names: ['eslint', 'ruff'], files: [TOOL_PACKAGE_PROJECT, TOOL_PYTHON_PROJECT] },
    {
        runner: 'mise',
        names: ['eslint', 'ruff', 'vale', 'uv'],
        files: [TOOL_PACKAGE_PROJECT, TOOL_PYTHON_PROJECT, MISE_CONFIG_PATH, MISE_CONFIG_PATH],
    },
];

export const MISE_DECLARATIONS =
    '[tools]\n"npm:eslint" = "9.0.0"\nruff = "0.9.0"\nvale = "3.0.0"\ndocker = "latest"\nuv = "0.10.0"\n';
