import { GOOGLE_PYPROJECT } from '#tests/config/python.ts';
import { ARITHMETIC_MODULE, BASE_INSTALLED_FILES } from '#tests/config/integration/checks/samples.ts';

export const ARITHMETIC_MODULE_PATH = 'example/math.py';

export const PYTHON_SANDBOX = {
    configurations: ['python'],
    files: {
        'pyproject.toml': GOOGLE_PYPROJECT,
        'example/__init__.py': '"""The test package."""\n',
        [ARITHMETIC_MODULE_PATH]: ARITHMETIC_MODULE,
    },
} as const;

export const RUFF_SANDBOX = {
    configurations: ['python', 'pytest'],
    level: 'all',
    files: BASE_INSTALLED_FILES,
} as const;
