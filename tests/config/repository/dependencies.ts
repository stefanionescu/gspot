export const PACKAGE_FIELDS = {
    name: 'example-package',
    dependencies: { next: '16.0.0' },
    'simple-git-hooks': null,
    customSettings: { enabled: true },
} as const;

/** Each package.json gives its own framework dependencies. */
export const PROJECT_DEPENDENCY_FILES = {
    'package.json': '{"dependencies":{"@nestjs/swagger":"11.2.3"}}',
    'app/package.json': '{"devDependencies":{"tailwindcss":"4.1.13"}}',
    'other/package.json': '{"dependencies":{"next":"16.3.5"}}',
    'empty/package.json': '{"private":true}',
    '.gspot/package.json': '{"dependencies":{"tailwindcss":"4.1.13"}}',
} as const;

export const PROJECT_DEPENDENCY_SCOPES = [
    { scope: '', names: ['@nestjs/swagger'] },
    { scope: 'application', names: ['@nestjs/swagger'] },
    { scope: 'app', names: ['tailwindcss'] },
    { scope: 'app/styles', names: ['tailwindcss'] },
    { scope: 'other', names: ['next'] },
    { scope: 'empty', names: [] },
    { scope: 'empty/src', names: [] },
] as const;

/** Invalid dependency file fields stay errors of the dependency file reader. */
export const INVALID_DEPENDENCY_FILES = [
    [
        'package.json',
        '{"dependencies":{"typescript":7}}',
        'package.json: dependencies.typescript: Invalid input: expected string, received number. Fix the field.',
    ],
    [
        'package.json',
        '{"scripts":{"lint":false}}',
        'package.json: scripts.lint: Invalid input: expected string, received boolean. Fix the field.',
    ],
    [
        'package.json',
        '{"workspaces":[7]}',
        'package.json: workspaces: Invalid input; workspaces.0: Invalid input: expected string, received number; workspaces: Invalid input: expected object, received array. Fix the field.',
    ],
    ['pyproject.toml', '[project', 'pyproject.toml:1:9 is not valid TOML: Error parsing TOML (1, 9):. Fix the file.'],
    [
        'pyproject.toml',
        '[project]\ndependencies = [7]\n',
        'pyproject.toml: project.dependencies.0: Invalid input: expected string, received number. Fix the field.',
    ],
    [
        'pyproject.toml',
        '[tool.poetry.dependencies]\nFastAPI = 7\n',
        'pyproject.toml: tool.poetry.dependencies.FastAPI: Invalid input; tool.poetry.dependencies.FastAPI: Invalid input: expected string, received number; tool.poetry.dependencies.FastAPI: Invalid input: expected record, received number; tool.poetry.dependencies.FastAPI: Invalid input: expected array, received number. Fix the field.',
    ],
    [
        'pyproject.toml',
        '[tool.poetry.group.web.dependencies]\nFastAPI = false\n',
        'pyproject.toml: tool.poetry.group.web.dependencies.FastAPI: Invalid input; tool.poetry.group.web.dependencies.FastAPI: Invalid input: expected string, received boolean; tool.poetry.group.web.dependencies.FastAPI: Invalid input: expected record, received boolean; tool.poetry.group.web.dependencies.FastAPI: Invalid input: expected array, received boolean. Fix the field.',
    ],
    [
        'Pipfile',
        '[packages]\nFastAPI = 7\n',
        'Pipfile: packages.FastAPI: Invalid input; packages.FastAPI: Invalid input: expected string, received number; packages.FastAPI: Invalid input: expected record, received number; packages.FastAPI: Invalid input: expected array, received number. Fix the field.',
    ],
] as const;

/** Root and child packages with different dependencies, read in one repository scan. */
export const REACT_VUE_PACKAGES = {
    'package.json': '{"name":"root-sandbox","private":true,"dependencies":{"react":"19.0.0"}}',
    'app/package.json': '{"name":"child-sandbox","private":true,"dependencies":{"vue":"3.5.0"}}',
    'main.js': 'export const ready = true;\n',
    'app/main.js': 'export const ready = true;\n',
} as const;

export const ROOT_PACKAGE_WITHOUT_DEPENDENCIES = '{"name":"root-sandbox","private":true,"dependencies":{}}';
