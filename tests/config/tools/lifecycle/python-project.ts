export const PYTHON_PROJECTS = [
    ['uv.toml', 'none'],
    ['pyproject.toml', 'mise'],
    ['pyproject.toml', 'none'],
] as const;

export const PYTHON_INSTALL_STEPS = {
    none: [
        ['uv', 'venv', '--relocatable', '.venv', '--project', '.gspot'],
        ['uv', 'sync', '--locked', '--no-install-project', '--project', '.gspot'],
    ],
    mise: [
        ['mise', 'install', 'uv@0.12.13'],
        ['mise', 'trust', '.mise/conf.d/gspot-tools.toml'],
        ['mise', 'install'],
        ['uv', 'venv', '--relocatable', '.venv', '--project', '.gspot'],
        ['uv', 'sync', '--locked', '--no-install-project', '--project', '.gspot'],
    ],
};
