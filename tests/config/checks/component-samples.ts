import { STRICT_COMPILER_OPTIONS } from '#tests/config/checks/language/typescript.ts';

/** The tsconfig.json of the component samples: the strict compiler options over `src`. */
export const COMPONENT_TSCONFIG = { compilerOptions: STRICT_COMPILER_OPTIONS, include: ['src'] } as const;

/** A TypeScript module a sandbox holds, so the compiler has a file to check. */
export const ANSWER_MODULE = `// A value the test files build on.

/** The fixed input shared by the component examples. */
export const answer = 42;
`;
