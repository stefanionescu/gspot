/** The license choice is authored explicitly in every scanning sandbox. */
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
    { name: 'empty installed report', stdout: '[]', code: 0, diagnostic: 'The license scan found no packages' },
    { name: 'scanner failure', stdout: '[]', code: 1, diagnostic: 'sample diagnostic' },
];

export const UNUSED_LICENSE_FILES = [
    { name: 'missing', content: undefined },
    { name: 'malformed', content: '{' },
    { name: 'stale', content: '{"allowed":[],"exceptions":{}}' },
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
        findings: [
            { rule: 'disallowed-license', diagnostic: 'strict@1.0.0 reports GPL-3.0-only' },
            { rule: 'stale-exception', diagnostic: 'strict@2.0.0 is absent from the installed project dependencies' },
        ],
    },
    {
        name: 'stale exception',
        license: 'GPL-3.0-only',
        package: 'strict@1.0.0',
        exception: 'LGPL-3.0-only',
        findings: [{ rule: 'disallowed-license', diagnostic: 'the exception no longer holds' }],
    },
    {
        name: 'changed license',
        license: 'MIT',
        package: 'strict@1.0.0',
        exception: 'LGPL-3.0-only',
        findings: [{ rule: 'disallowed-license', diagnostic: 'reports MIT' }],
    },
    {
        name: 'normalized Python identity',
        installed: 'Strict_Package',
        license: 'GPL-3.0-only',
        package: 'strict.package@1.0.0',
        exception: 'GPL-3.0-only',
        findings: [],
    },
    { name: 'corrected exception', license: 'MIT', package: 'strict@1.0.0', exception: 'MIT', findings: [] },
];

/** JavaScript identities stay exact while Python identities normalize in their own reports. */
export const PROJECT_FINDINGS = [
    { file: 'package.json', message: 'unknown@1.0.0 reports UNKNOWN' },
    { file: 'package.json', message: 'python.package@2.0.0 reports GPL-3.0-only' },
    { file: 'pyproject.toml', message: 'prohibited-python@2.0.0 reports GPL-3.0-only' },
];
