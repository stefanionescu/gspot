import type { FindingCase } from '#tests/types/harness/check-case.ts';
import type { RepositoryScenario } from '#tests/types/harness/repository.ts';
import { GREET, MIGRATION, SUPABASE_CONFIG } from '#tests/config/cli/checks/platform/supabase/configuration.ts';

/** Authored inputs and configuration selection for this scenario. */
export const REPOSITORY: RepositoryScenario = {
    configurations: ['supabase'],
    modules: false,
    installs: false,
    files: {
        'supabase/config.toml': SUPABASE_CONFIG,
        'supabase/migrations/20240101000000_create_avatars.sql': MIGRATION,
        'supabase/functions/greet/index.ts': GREET,
    },
};

export const KEY = 'SUPABASE_SERVICE_ROLE_KEY';

/** Defects, expected findings, and explicit corrections. */
export const CASES: FindingCase[] = [
    {
        check: 'supabase/config',
        files: { 'supabase/config.toml': `${SUPABASE_CONFIG}\n[functions.missing]\nverify_jwt = true\n` },
        expected: { file: 'supabase/config.toml', rule: 'function', line: 1 },
    },
    {
        check: 'supabase/config',
        files: { 'supabase/config.toml': 'project_id = \n' },
        expected: { file: 'supabase/config.toml', rule: 'syntax', line: 1 },
    },
    {
        check: 'supabase/storage-policies',
        files: { 'supabase/config.toml': `${SUPABASE_CONFIG}\n[storage.buckets.receipts]\npublic = false\n` },
        expected: { file: 'supabase/config.toml', rule: 'bucket-policy', line: 1 },
    },
    {
        check: 'supabase/migration-names',
        files: { 'supabase/migrations/002-AddThing.sql': 'SELECT 1;\n' },
        expected: { file: 'supabase/migrations/002-AddThing.sql', rule: 'migration-name', line: 1 },
    },
    {
        check: 'supabase/admin-key',
        files: { 'app/client.ts': `export const key = process.env.${KEY};\n` },
        expected: { file: 'app/client.ts', rule: 'admin-key', line: 1 },
    },
];

export const TEST_PATH_POLICY =
    'configurations = ["supabase"]\ntests = ["qa/**"]\n[[scope]]\npath = "apps/web"\ntests = ["verification/**"]\n';

export const TEST_PATH_FILES = {
    'qa/entry.ts': 'export const key = process.env.SUPABASE_SERVICE_ROLE_KEY;\n',
    'tests/default.ts': 'export const key = process.env.SUPABASE_SERVICE_ROLE_KEY;\n',
    'client.ts': 'export const key = process.env.SUPABASE_SERVICE_ROLE_KEY;\n',
    'apps/web/verification/entry.ts': 'export const key = process.env.SUPABASE_SERVICE_ROLE_KEY;\n',
    'apps/web/qa/entry.ts': 'export const key = process.env.SUPABASE_SERVICE_ROLE_KEY;\n',
    'apps/web/client.ts': 'export const key = process.env.SUPABASE_SERVICE_ROLE_KEY;\n',
};
