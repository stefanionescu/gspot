import { RECOMMENDED_COMPILER_OPTIONS } from '#cli/constants/checks/typescript.ts';
/** Additional compiler diagnostics required at all. */
export const ALL_COMPILER_OPTIONS = {
    ...RECOMMENDED_COMPILER_OPTIONS,
    noFallthroughCasesInSwitch: true,
    noUncheckedIndexedAccess: true,
    noImplicitOverride: true,
    exactOptionalPropertyTypes: true,
};
