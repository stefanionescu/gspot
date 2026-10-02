// The planted component sources and compiler options that several kit tests share.
export const LIBRARIES_CLEAN =
    '// A value the planted files build on.\n\n/** The answer. */\nexport const answer = 42;\n';

/** The strict compiler options a planted TypeScript repository reads. */
export const COMPONENT_TSCONFIG =
    '{\n    "compilerOptions": {\n        "strict": true,\n        "noFallthroughCasesInSwitch": true,\n        "noUncheckedIndexedAccess": true,\n        "noImplicitOverride": true,\n        "exactOptionalPropertyTypes": true,\n        "target": "ES2022",\n        "module": "NodeNext",\n        "moduleResolution": "NodeNext",\n        "types": [],\n        "skipLibCheck": true\n    },\n    "include": ["src"]\n}\n';

/** A TypeScript module a planted repository holds, so the compiler has an input. */
export const COMPONENT_SOURCE =
    '// A value the planted files build on.\n\n/** The answer. */\nexport const answer = 42;\n';
