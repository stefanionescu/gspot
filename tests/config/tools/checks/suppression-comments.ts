// Each Ruff directive, whether Ruff honors it for F401, and whether gspot records it as a directive on line 1.
export const RUFF_DIRECTIVES = [
    { source: 'import os # noqa: F401\n', suppressed: true, directive: true },
    { source: 'import os # NOQA: F401\n', suppressed: true, directive: true },
    { source: 'import os # NoQa: F401\n', suppressed: true, directive: true },
    { source: 'import os # Example noqa: F401\n', suppressed: false, directive: false },
    { source: 'import os # Example # noqa: F401\n', suppressed: true, directive: true },
    { source: 'import os # noqa-unknown: F401\n', suppressed: false, directive: false },
    { source: 'import os # noqa: F401 # reason: External import.\n', suppressed: true, directive: true },
    { source: '# ruff: noqa: F401\nimport os\n', suppressed: true, directive: true },
    { source: '# ruff: NoQa: F401\nimport os\n', suppressed: true, directive: true },
    { source: '# flake8: noqa: F401\nimport os\n', suppressed: true, directive: true },
    { source: '# Example # ruff: noqa: F401\nimport os\n', suppressed: true, directive: true },
    { source: 'import os # ruff: noqa: F401\n', suppressed: false, directive: false },
    { source: 'import os # flake8: noqa: F401\n', suppressed: false, directive: false },
    { source: '# RUFF: NOQA: F401\nimport os\n', suppressed: false, directive: false },
    { source: '# noqa: F401\nimport os\n', suppressed: false, directive: true },
    { source: 'import os # noqa: F821\n', suppressed: false, directive: true },
];
