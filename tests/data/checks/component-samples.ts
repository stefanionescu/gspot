import { STRICT_COMPILER_OPTIONS } from '#tests/data/checks/typescript/projects.ts';

/** The strict compiler options a test TypeScript repository reads. */
export const COMPONENT_TSCONFIG = { compilerOptions: STRICT_COMPILER_OPTIONS, include: ['src'] } as const;

/** A TypeScript module a sandbox holds, so the compiler has an input. */
export const ANSWER_MODULE = `// A value the test files build on.

/** The fixed input shared by the component examples. */
export const answer = 42;
`;
