// The test component sources and compiler options that several configuration tests share.

import { STRICT_COMPILER_OPTIONS } from '#tests/config/samples/typescript.ts';

/** The strict compiler options a test TypeScript repository reads. */
export const COMPONENT_TSCONFIG = { compilerOptions: STRICT_COMPILER_OPTIONS, include: ['src'] };

/** A TypeScript module a sandbox holds, so the compiler has an input. */
export const COMPONENT_SOURCE =
    '// A value the test files build on.\n\n/** The answer. */\nexport const answer = 42;\n';
