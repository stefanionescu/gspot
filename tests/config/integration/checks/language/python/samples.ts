import { BASE_INSTALLED_FILES } from '#tests/config/setup/sandboxes.ts';
import { ARITHMETIC_MODULE } from '#tests/config/integration/checks/samples.ts';
import { GOOGLE_PYPROJECT } from '#tests/config/checks/language/python/project.ts';

export const ARITHMETIC_MODULE_PATH = 'example/math.py';

export const PYTHON_SANDBOX = {
    configurations: ['python'],
    files: {
        'pyproject.toml': GOOGLE_PYPROJECT,
        'pyrightconfig.json': `{
    "typeCheckingMode": "basic",
    "exclude": [".venv", "example/skipped.py"]
}
`,
        'example/skipped.py': '"""A file the old setup left out."""\n',
        'example/__init__.py': '"""The test package."""\n',
        [ARITHMETIC_MODULE_PATH]: ARITHMETIC_MODULE,
    },
} as const;

export const RUFF_SANDBOX = {
    configurations: ['python', 'pytest'],
    level: 'all',
    files: BASE_INSTALLED_FILES,
} as const;
