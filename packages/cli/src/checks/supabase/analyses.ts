// The supabase analyses, by the name a manifest check gives them.
import type { Engine } from '#cli/types/checks.ts';
import { adminKey } from '#cli/checks/supabase/admin-key.ts';
import { typesFresh } from '#cli/checks/supabase/types-fresh.ts';
import { denoLint, denoCheck } from '#cli/checks/supabase/deno.ts';
import { projectValid, migrationNames, storagePolicies } from '#cli/checks/supabase/config-checks.ts';

export const SUPABASE_ANALYSES: Record<string, Engine> = {
    'supabase-config': projectValid,
    'supabase-storage': storagePolicies,
    'supabase-migration-names': migrationNames,
    'supabase-deno-lint': denoLint,
    'supabase-deno-check': denoCheck,
    'supabase-admin-key': adminKey,
    'supabase-types': typesFresh,
};
