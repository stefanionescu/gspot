export const LICENSES_ROOT_PACKAGE = `{
    "name": "example",
    "version": "1.0.0",
    "private": true,
    "dependencies": { "kind": "1.0.0", "choice": "1.0.0", "combined": "1.0.0", "strict": "1.0.0" }
}
`;

export const LICENSED_PACKAGES = {
    'node_modules/strict/package.json': JSON.stringify({ name: 'strict', version: '1.0.0', license: 'MIT' }),
    'node_modules/kind/package.json': JSON.stringify({ name: 'kind', version: '1.0.0', license: 'MIT' }),
    'node_modules/choice/package.json': JSON.stringify({
        name: 'choice',
        version: '1.0.0',
        license: 'MIT OR (GPL-3.0-only AND GPL-2.0-only)',
    }),
    'node_modules/combined/package.json': JSON.stringify({
        name: 'combined',
        version: '1.0.0',
        license: 'MIT AND (Apache-2.0 OR GPL-3.0-only)',
    }),
} as const;

export const PIP_LICENSES_PYPROJECT = `[project]
name = "sample"
version = "0.0.0"
[tool.pip-licenses]
ignore-packages = ["licensed-example"]
`;

export const MIT_ONLY = { allowed: ['MIT'] } as const;
