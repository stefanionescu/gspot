import { describe, test } from 'bun:test';

import { PYTHON_RULE_SOURCES, SEMGREP_CHECK_ID, SEMGREP_SANDBOX } from '#tests/config/integration/semgrep.ts';
import { assertCheckSample } from '#tests/setup/cli/samples.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildSandboxChanges } from '#tests/setup/sandboxes/changes.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { hasToolBuild } from '#tests/setup/system/platform.ts';

const CASES = [
    {
        configuration: 'django',
        level: 'all',
        dependency: 'django',
        files: { 'views.py': PYTHON_RULE_SOURCES.django, 'settings.py': 'SESSION_COOKIE_SECURE = False\n' },
        findings: [
            ['settings.py', 1, 'gspot.django.insecure-cookie-setting'],
            ['views.py', 14, 'gspot.django.request-data-in-redirect'],
            ['views.py', 26, 'gspot.django.request-data-in-file-path'],
            ['views.py', 36, 'gspot.django.request-data-in-outbound-request'],
            ['views.py', 41, 'gspot.django.request-data-in-html-response'],
            ['views.py', 49, 'gspot.django.csrf-exempt'],
        ],
    },
    {
        configuration: 'flask',
        level: 'all',
        dependency: 'flask',
        files: { 'app.py': PYTHON_RULE_SOURCES.flask },
        findings: [
            ['app.py', 8, 'gspot.flask.insecure-setting'],
            ['app.py', 14, 'gspot.flask.request-data-in-redirect'],
            ['app.py', 24, 'gspot.flask.request-data-in-file-path'],
            ['app.py', 35, 'gspot.flask.request-data-in-outbound-request'],
            ['app.py', 41, 'gspot.flask.request-data-in-html-response'],
            ['app.py', 57, 'gspot.flask.request-data-in-template-source'],
            ['app.py', 62, 'gspot.flask.request-data-in-html-response'],
        ],
    },
    {
        configuration: 'pyjwt',
        level: 'all',
        dependency: 'PyJWT',
        files: { 'tokens.py': PYTHON_RULE_SOURCES.pyjwt },
        findings: [
            ['tokens.py', 6, 'gspot.pyjwt.unverified-decode'],
            ['tokens.py', 7, 'gspot.pyjwt.unverified-decode'],
            ['tokens.py', 8, 'gspot.pyjwt.none-algorithm'],
            ['tokens.py', 9, 'gspot.pyjwt.none-algorithm'],
            ['tokens.py', 10, 'gspot.pyjwt.hardcoded-key'],
        ],
    },
    {
        configuration: 'machine-learning',
        level: 'all',
        dependency: 'torch',
        files: { 'model.py': PYTHON_RULE_SOURCES['machine-learning'] },
        findings: [
            ['model.py', 7, 'gspot.ml.unsafe-torch-load'],
            ['model.py', 9, 'gspot.ml.numpy-pickle-load'],
            ['model.py', 11, 'gspot.ml.trust-remote-code'],
            ['model.py', 11, 'gspot.ml.unpinned-hub-download'],
            ['model.py', 12, 'gspot.ml.joblib-load'],
            ['model.py', 13, 'gspot.ml.unpinned-hub-download'],
            ['model.py', 15, 'gspot.ml.unpinned-hub-download'],
            ['model.py', 17, 'gspot.ml.unpinned-hub-download'],
        ],
    },
    {
        configuration: 'machine-learning',
        level: 'basic',
        dependency: 'torch',
        files: { 'model.py': PYTHON_RULE_SOURCES['machine-learning'] },
        findings: [
            ['model.py', 7, 'gspot.ml.unsafe-torch-load'],
            ['model.py', 9, 'gspot.ml.numpy-pickle-load'],
            ['model.py', 11, 'gspot.ml.trust-remote-code'],
        ],
    },
] as const;

describe.skipIf(!hasToolBuild('semgrep'))('semgrep', () => {
    const installedSandbox = shareInstalledSandbox(SEMGREP_SANDBOX);
    test.each([...CASES])(
        'the $configuration rules at level $level report each unsafe call and accept a module without one',
        async ({ configuration, level, dependency, files, findings }) => {
            const sourceFiles = {
                'gspot.toml': buildSandboxSettings([configuration, 'security'], { level }),
                'pyproject.toml': `[project]\nname = "example"\nversion = "1.0.0"\ndependencies = ["${dependency}"]\n`,
                ...files,
            };
            const expected = findings.map(([file, line, rule]) => ({ file, line, rule }));
            await assertCheckSample(installedSandbox(), {
                ...buildSandboxChanges(SEMGREP_SANDBOX.files, sourceFiles),
                check: SEMGREP_CHECK_ID,
                apply: true,
                expected: expected[0]!,
                findings: expected,
                corrected: {
                    files: {
                        ...sourceFiles,
                        ...Object.fromEntries(Object.keys(files).map((path) => [path, 'VALUE = 1\n'])),
                    },
                },
            });
        },
    );
});
