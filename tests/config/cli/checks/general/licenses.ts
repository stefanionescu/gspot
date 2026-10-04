/** The license choice is authored explicitly in every scanning fixture. */
export const LICENSE_SETTINGS = '[licenses]\nallowed = ["MIT"]\n';

/** Version commands run through the real executable boundary using the declared pin. */
export const SCANNERS = {
    windows: { path: '.gspot/.venv/Scripts/pip-licenses.cmd', body: '@echo pip-licenses VERSION\r\n' },
    posix: { path: '.gspot/.venv/bin/pip-licenses', body: '#!/bin/sh\nprintf "pip-licenses VERSION\\n"\n' },
};

/** The npm scanner declares exit one for its version command. */
export const NPM_SCANNERS = {
    windows: {
        path: '.gspot/node_modules/.bin/license-checker-rseidelsohn.cmd',
        body: '@echo VERSION\r\n@exit /b 1\r\n',
    },
    posix: {
        path: '.gspot/node_modules/.bin/license-checker-rseidelsohn',
        body: '#!/bin/sh\nprintf "VERSION\\n"\nexit 1\n',
    },
};

export const SCANNER_FAILURES = [
    { name: 'malformed JSON', stdout: '{', code: 0, diagnostic: 'JSON' },
    { name: 'scanner failure', stdout: '[]', code: 1, diagnostic: 'fixture diagnostic' },
];

export const CONFIGURATION_FAILURES = [
    { name: 'missing', content: undefined, diagnostic: 'License configuration is missing' },
    { name: 'malformed', content: '{', diagnostic: 'JSON' },
    { name: 'stale', content: '{"allowed":[],"exceptions":[]}', diagnostic: 'differs from the selected policy' },
];

/** Exact exceptions must match both the package version and its reported license. */
export const LICENSE_EXCEPTIONS = [
    {
        name: 'exact exception',
        license: 'GPL-3.0-only',
        package: 'strict@1.0.0',
        exception: 'GPL-3.0-only',
        findings: [],
    },
    {
        name: 'another package version',
        license: 'GPL-3.0-only',
        package: 'strict@2.0.0',
        exception: 'GPL-3.0-only',
        findings: ['reports GPL-3.0-only'],
    },
    {
        name: 'stale exception',
        license: 'GPL-3.0-only',
        package: 'strict@1.0.0',
        exception: 'LGPL-3.0-only',
        findings: ['the exception no longer holds'],
    },
    {
        name: 'changed license',
        license: 'MIT',
        package: 'strict@1.0.0',
        exception: 'LGPL-3.0-only',
        findings: ['reports MIT'],
    },
    { name: 'corrected exception', license: 'MIT', package: 'strict@1.0.0', exception: 'MIT', findings: [] },
];
