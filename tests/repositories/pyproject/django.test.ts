// Planted repository for the django preset: a deprecated form, a migration Django named, one with no way back, unsafe settings, and a model rule of Ruff.
import { join } from 'node:path';
import { createFixture } from 'fs-fixture';
import { chmodSync, mkdirSync } from 'node:fs';
import type { PlantedCase } from '#types/run.ts';
import { describe, expect, test } from 'bun:test';
import { commitAll, install, PLANTED_TIMEOUT_MS, run, runPlanted, toolsPath } from '#tests/harness/planted.ts';

const INIT = [
    'init',
    '--yes',
    '--presets',
    'python,django',
    '--without',
    'naming,structure,spelling,dependencies,pytest,security,postgres',
    '--runner',
    'none',
    '--ci',
    'none',
    '--hooks',
    'none',
    '--no-rules',
    '--no-install',
];
const RUNS = 0o755;
const PROJECT =
    '[project]\nname = "planted"\nversion = "1.0.0"\nrequires-python = ">=3.12"\ndependencies = ["django>=5.2"]\n';
const SETTINGS =
    '"""Settings a deploy reads."""\n\nimport os\n\nDEBUG = os.environ.get("DEBUG") == "1"\nALLOWED_HOSTS = os.environ["ALLOWED_HOSTS"].split(",")\nSECRET_KEY = os.environ["SECRET_KEY"]\n';
const migration = (operation: string): string =>
    `"""Fills the slug of every shop."""\n\nfrom django.db import migrations\n\n\ndef fill(apps: object, schema_editor: object) -> None:\n    """Fill the slugs.\n\n    Args:\n        apps: The app registry.\n        schema_editor: The schema editor.\n    """\n\n\nclass Migration(migrations.Migration):\n    """Fills the slugs."""\n\n    dependencies = [("shops", "0001_initial")]\n    operations = [${operation}]\n`;
const MODEL =
    '"""The shops."""\n\nfrom django.db import models\n\n\nclass Shop(models.Model):\n    """One shop."""\n\n    nickname = models.CharField(max_length=40, null=True)\n\n    def __str__(self) -> str:\n        """Return the nickname.\n\n        Returns:\n            The nickname.\n        """\n        return self.nickname or ""\n';

const CASES: PlantedCase[] = [
    {
        id: 'django/upgrade',
        files: {
            'shops/urls.py':
                '"""The routes."""\n\nfrom django.conf.urls import url\n\nfrom shops import views\n\nurlpatterns = [url(r"^$", views.index)]\n',
        },
        expected: 'django-upgrade rewrites this file',
    },
    {
        id: 'django/migration-names',
        files: {
            'shops/migrations/0002_auto_20260101_1200.py': migration(
                'migrations.RunPython(fill, migrations.RunPython.noop)',
            ),
        },
        expected: 'keeps the name Django gave it',
    },
    {
        id: 'django/migration-reversible',
        files: { 'shops/migrations/0002_fill_slugs.py': migration('migrations.RunPython(fill)') },
        expected: 'names no reverse_code',
    },
    {
        id: 'django/settings',
        files: {
            'planted/settings.py': SETTINGS.replace('DEBUG = os.environ.get("DEBUG") == "1"', () => 'DEBUG = True'),
        },
        expected: 'DEBUG is on in a settings module a deploy reads',
    },
    { id: 'python/ruff', files: { 'shops/models.py': MODEL }, expected: 'DJ001' },
];

describe('the django preset', () => {
    test(
        'django-upgrade, the migration checks, the settings check and the Django rules of Ruff fire on their planted defects',
        async () => {
            await using fixture = await createFixture({
                'pyproject.toml': PROJECT,
                'planted/__init__.py': '"""The planted project."""\n',
                'planted/settings.py': SETTINGS,
                'planted/settings/local.py': '"""Settings for one developer."""\n\nDEBUG = True\n',
                'shops/__init__.py': '"""The shops app."""\n',
                'shops/migrations/__init__.py': '"""The migrations of the shops app."""\n',
                'shops/migrations/0002_fill_slugs.py': migration(
                    'migrations.RunPython(fill, reverse_code=migrations.RunPython.noop)',
                ),
            });
            commitAll(fixture.path);
            const environment = { PATH: toolsPath(['ruff', 'basedpyright', 'django-upgrade', 'typos', 'ec']) };
            await install(fixture.path, INIT, environment);
            for (const planted of CASES) {
                const clean = run(fixture.path, ['check', planted.id, '--no-cache'], environment);
                expect(clean.code, `${planted.id}: ${clean.stdout}${clean.stderr}`).toBe(0);
                const outcome = await runPlanted(fixture.path, planted, environment);
                expect(outcome.code, `${planted.id}: ${outcome.stdout}${outcome.stderr}`).toBe(1);
                expect(outcome.stdout + outcome.stderr, planted.id).toContain(planted.expected);
            }
            // No Django is installed beside the fixture, so the check that asks Django says so and is no error.
            const fresh = run(fixture.path, ['check', 'django/migrations-fresh', '--no-cache'], environment);
            expect(fresh.stdout + fresh.stderr).not.toContain('engine failed');
        },
        PLANTED_TIMEOUT_MS * 8,
    );

    test(
        'a model with no migration is a finding that names the app',
        async () => {
            await using fixture = await createFixture({
                'pyproject.toml': PROJECT,
                'manage.py': '"""Runs the management commands."""\n',
                'planted/__init__.py': '"""The planted project."""\n',
            });
            // Django is not installed beside the fixture, so a script answers the way manage.py answers.
            await using tools = await createFixture({});
            const bin = join(tools.path, 'bin');
            mkdirSync(bin);
            const answer =
                "Migrations for 'shops':\n  shops/migrations/0003_shop_slug.py\n    + Add field slug to shop";
            await Bun.write(join(bin, 'python3'), `#!/bin/sh\ncat <<'REPORT'\n${answer}\nREPORT\nexit 1\n`);
            chmodSync(join(bin, 'python3'), RUNS);
            commitAll(fixture.path);
            await install(fixture.path, INIT, {
                PATH: toolsPath(['ruff', 'basedpyright', 'django-upgrade', 'typos', 'ec']),
            });
            const environment = { PATH: `${bin}:${toolsPath(['ruff', 'typos', 'ec'])}` };
            const outcome = run(fixture.path, ['check', 'django/migrations-fresh', '--no-cache'], environment);
            expect(outcome.code, outcome.stdout + outcome.stderr).toBe(1);
            expect(outcome.stdout).toContain('The models of shops changed and no migration records it');
        },
        PLANTED_TIMEOUT_MS * 4,
    );
});
