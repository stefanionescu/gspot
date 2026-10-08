export const AUTHORED_PACKAGE_FIELDS = {
    name: 'example-package',
    dependencies: { next: '16.0.0' },
    'simple-git-hooks': null,
    customSettings: { enabled: true },
} as const;

/** npm project boundaries separate framework-specific dependency contracts. */
export const PROJECT_DEPENDENCY_FILES = {
    'package.json': '{"dependencies":{"@nestjs/swagger":"11.2.3"}}',
    'app/package.json': '{"devDependencies":{"tailwindcss":"4.1.13"}}',
    'other/package.json': '{"dependencies":{"next":"16.3.5"}}',
    'empty/package.json': '{"private":true}',
    '.gspot/package.json': '{"dependencies":{"tailwindcss":"4.1.13"}}',
};

export const PROJECT_DEPENDENCY_SCOPES = [
    { scope: '', dependencies: { '@nestjs/swagger': '11.2.3' } },
    { scope: 'application', dependencies: { '@nestjs/swagger': '11.2.3' } },
    { scope: 'app', dependencies: { tailwindcss: '4.1.13' } },
    { scope: 'app/styles', dependencies: { tailwindcss: '4.1.13' } },
    { scope: 'other', dependencies: { next: '16.3.5' } },
    { scope: 'empty', dependencies: {} },
    { scope: 'empty/src', dependencies: {} },
];

/** Distinct native Python manifest forms retain their own input and expected dependency behavior. */
export const INVALID_PYTHON_DEPENDENCY_CASES = [
    { name: 'Poetry numeric dependency', path: 'pyproject.toml', source: '[tool.poetry.dependencies]\nFastAPI = 7\n' },
    {
        name: 'Poetry boolean group dependency',
        path: 'pyproject.toml',
        source: '[tool.poetry.group.web.dependencies]\nFastAPI = false\n',
    },
    { name: 'Pipfile numeric dependency', path: 'Pipfile', source: '[packages]\nFastAPI = 7\n' },
];

/** Invalid authored fields remain manifest-reader errors. */
export const INVALID_MANIFESTS = [
    ['package.json', '{"dependencies":{"typescript":7}}'],
    ['package.json', '{"scripts":{"lint":false}}'],
    ['package.json', '{"workspaces":[7]}'],
    ['pyproject.toml', '[project'],
    ['pyproject.toml', '[project]\ndependencies = [7]\n'],
];
