import type { FindingCase } from '#tests/types/harness/check-case.ts';
import type { RepositoryScenario } from '#tests/types/harness/repository.ts';
import { GREET, MIGRATION, SUPABASE_CONFIG } from '#tests/config/cli/checks/platform/supabase/configuration.ts';

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

export const CASES: FindingCase[] = [
    {
        check: 'supabase/storage-policies',
        files: { 'supabase/config.toml': `${SUPABASE_CONFIG}\n[storage.buckets.receipts]\npublic = false\n` },
        expected: { file: 'supabase/config.toml', rule: 'bucket-policy', line: 1 },
    },
];

export const TEST_PATH_POLICY =
    'configurations = ["supabase"]\ntest_files = ["qa/**"]\n[scope."apps/web"]\ntest_files = ["qa/**", "verification/**"]\n';

export const TEST_PATH_FILES = {
    'qa/entry.ts': 'export const key = process.env.SUPABASE_SERVICE_ROLE_KEY;\n',
    'tests/default.ts': 'export const key = process.env.SUPABASE_SERVICE_ROLE_KEY;\n',
    'client.ts': 'export const key = process.env.SUPABASE_SERVICE_ROLE_KEY;\n',
    'apps/web/verification/entry.ts': 'export const key = process.env.SUPABASE_SERVICE_ROLE_KEY;\n',
    'apps/web/qa/entry.ts': 'export const key = process.env.SUPABASE_SERVICE_ROLE_KEY;\n',
    'apps/web/client.ts': 'export const key = process.env.SUPABASE_SERVICE_ROLE_KEY;\n',
};

/** Secret-key reads and the safe publishable-key replacement for each source. */
export const SECRET_KEY_READS = [
    'process.env.SUPABASE_SECRET_KEY',
    'settings.supabase_secret_key',
    'settings.supabaseSecretKey',
    '"sb_secret_example"',
];
