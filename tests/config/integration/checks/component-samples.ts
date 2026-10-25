import { STRICT_COMPILER_OPTIONS } from '#tests/config/checks/language/typescript.ts';

export const COMPONENT_TSCONFIG = { compilerOptions: STRICT_COMPILER_OPTIONS, include: ['src'] } as const;

export const ANSWER_MODULE = `// A value the test files build on.

/**
The fixed input shared by the component examples.
*/
export const answer = 42;
`;
