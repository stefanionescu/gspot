export const KNIP = '.gspot/config/knip.json';
export const STYLELINT = '.gspot/config/stylelint.json';
export const RUFF = '.gspot/config/ruff.toml';

export const TAILWIND_PROJECT_FILES = {
    'package.json': '{"private":true,"devDependencies":{"tailwindcss":"4.1.13"}}\n',
};

/** Check-specific file ignores reach the native discovery owners that read them. */
export const PATH_IGNORE_CONFIGURATIONS = [
    {
        configuration: 'spelling',
        check: 'spelling/typos',
        path: '.gspot/config/typos.toml',
        nativePath: ['files', 'extend-exclude'],
    },
    {
        configuration: 'duplication',
        check: 'duplication/jscpd',
        path: '.gspot/config/jscpd.json',
        nativePath: ['ignore'],
    },
    { configuration: 'javascript', check: 'javascript/knip', path: KNIP, nativePath: ['ignore'] },
];
