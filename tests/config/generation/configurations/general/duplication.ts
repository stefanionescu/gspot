export const PYTHON_IMPORT_EXCLUSIONS = [
    { source: 'import os\nimport pathlib as paths\n', expected: '' },
    { source: 'from .package import first as renamed, second\n', expected: '' },
    { source: 'from package import (\n    first as renamed,\n    second,\n)\n', expected: '' },
    { source: 'import first, \\\n    second as renamed\n', expected: '' },
    { source: 'from package \\\n    import first, \\\n    second\n', expected: '' },
    { source: 'from package import \\\n    (first,\n     second)\n', expected: '' },
    { source: 'import os; calculate_total()\n', expected: '; calculate_total()' },
    { source: 'from package import (first, second); calculate_total()\n', expected: '; calculate_total()' },
    {
        source: 'description = "Users import packages to calculate totals"\n',
        expected: 'description = "Users import packages to calculate totals"',
    },
    { source: '# Explain how to import packages\n', expected: '# Explain how to import packages' },
    { source: 'from package import first\ncalculate_total()\n', expected: 'calculate_total()' },
] as const;
