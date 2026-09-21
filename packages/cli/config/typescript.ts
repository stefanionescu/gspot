/** Compiler flags that add diagnostics without changing module resolution or emitted JavaScript. */
export const RECOMMENDED_COMPILER_OPTIONS = { strict: true };

/** Additional compiler diagnostics required at all. */
export const ALL_COMPILER_OPTIONS = {
    ...RECOMMENDED_COMPILER_OPTIONS,
    noFallthroughCasesInSwitch: true,
    noUncheckedIndexedAccess: true,
    noImplicitOverride: true,
    exactOptionalPropertyTypes: true,
};
