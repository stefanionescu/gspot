// The postgres analyses, by the name a manifest check gives them.
import type { Engine } from '#cli/types/checks.ts';
import { migrationDocs } from '#cli/checks/postgres/migration-docs.ts';
import { migrationOrder, migrationsFrozen } from '#cli/checks/postgres/history.ts';

import {
    rlsPresent,
    explicitGrants,
    definerSearchPath,
    foreignKeyIndexes,
} from '#cli/checks/postgres/schema/checks.ts';

export const POSTGRES_ANALYSES: Record<string, Engine> = {
    'postgres-rls': rlsPresent,
    'postgres-grants': explicitGrants,
    'postgres-definer': definerSearchPath,
    'postgres-foreign-keys': foreignKeyIndexes,
    'postgres-order': migrationOrder,
    'postgres-frozen': migrationsFrozen,
    'postgres-docs': migrationDocs,
};
