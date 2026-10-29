export const COVERAGE_PROJECT_FILES = [
    { name: 'generated defaults', files: {}, generated: true },
    { name: '.coveragerc', files: { '.coveragerc': '[run]\nomit = custom/**\n' }, generated: false },
    {
        name: 'pyproject coverage',
        files: { 'pyproject.toml': '[tool.coverage.run]\nomit = ["custom/**"]\n' },
        generated: false,
    },
    { name: 'setup.cfg coverage', files: { 'setup.cfg': '[coverage:run]\nomit = custom/**\n' }, generated: false },
    { name: 'tox.ini coverage', files: { 'tox.ini': '[coverage:run]\nomit = custom/**\n' }, generated: false },
] as const;
