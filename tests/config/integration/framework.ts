import { STRICT_COMPILER_OPTIONS } from '#tests/config/setup/languages.ts';

export const ANSWER_MODULE = `// A value the test files build on.

/**
The fixed input shared by the component examples.
*/
export const answer = 42;
`;
export const COMPONENT_TSCONFIG = { compilerOptions: STRICT_COMPILER_OPTIONS, include: ['src'] } as const;
