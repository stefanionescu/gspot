// The test component sources and compiler options that several configuration tests share.

/** The strict compiler options a test TypeScript repository reads. */
export const COMPONENT_TSCONFIG =
    '{\n    "compilerOptions": {\n        "strict": true,\n        "noFallthroughCasesInSwitch": true,\n        "noUncheckedIndexedAccess": true,\n        "noImplicitOverride": true,\n        "exactOptionalPropertyTypes": true,\n        "noImplicitReturns": true,\n        "noPropertyAccessFromIndexSignature": true,\n        "target": "ES2022",\n        "module": "NodeNext",\n        "moduleResolution": "NodeNext",\n        "types": [],\n        "skipLibCheck": true\n    },\n    "include": [\n        "src"\n    ]\n}' +
    '\n';

/** A TypeScript module a test repository holds, so the compiler has an input. */
export const COMPONENT_SOURCE =
    '// A value the test files build on.\n\n/** The answer. */\nexport const answer = 42;\n';
