import type { ImportDirectionRoles, ImportDirectionOptions } from '#plugin/types/import-direction.ts';

/** User options may omit roles and individual role lists before the rule applies defaults. */
export type ImportDirectionInput = [
    Partial<Omit<ImportDirectionOptions[0], 'roles'>> & { roles?: Partial<ImportDirectionRoles> },
];
