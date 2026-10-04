// The test React and React Native repositories: their packages, compiler options, and a clean component.

import testsPackage from '#tests/package.json' with { type: 'json' };

/** The packages of a test Expo repository. */
export const EXPO_DEPENDENCIES = {
    expo: '54.0.0',
    react: testsPackage.devDependencies['react'],
    'react-native': '0.81.4',
};

/** The packages of a bare React Native repository. */
export const NATIVE_DEPENDENCIES = { react: testsPackage.devDependencies['react'], 'react-native': '0.81.4' };

/** The packages of a test React web repository. */
export const WEB_DEPENDENCIES = {
    react: testsPackage.devDependencies['react'],
    'react-dom': testsPackage.devDependencies['react-dom'],
};

/** The compiler options of a test React Native repository. */
export const NATIVE_TSCONFIG =
    '{\n    "compilerOptions": {\n        "strict": true,\n        "noFallthroughCasesInSwitch": true,\n        "noUncheckedIndexedAccess": true,\n        "noImplicitOverride": true,\n        "exactOptionalPropertyTypes": true,\n        "noImplicitReturns": true,\n        "noPropertyAccessFromIndexSignature": true,\n        "target": "ES2022",\n        "module": "ESNext",\n        "moduleResolution": "Bundler",\n        "types": [],\n        "skipLibCheck": true,\n        "jsx": "react-jsx"\n    },\n    "include": [\n        "src"\n    ]\n}\n';

/** The compiler options of a test React web repository. */
export const WEB_TSCONFIG =
    '{\n    "compilerOptions": {\n        "strict": true,\n        "noFallthroughCasesInSwitch": true,\n        "noUncheckedIndexedAccess": true,\n        "noImplicitOverride": true,\n        "exactOptionalPropertyTypes": true,\n        "noImplicitReturns": true,\n        "noPropertyAccessFromIndexSignature": true,\n        "target": "ES2022",\n        "module": "ESNext",\n        "moduleResolution": "Bundler",\n        "types": [],\n        "skipLibCheck": true,\n        "jsx": "react-jsx",\n        "lib": [\n            "DOM",\n            "ES2022"\n        ]\n    },\n    "include": [\n        "src"\n    ]\n}\n';

/** A component accepted by the configured React rules. */
export const CLEAN_COMPONENT =
    "// A test component.\nimport type { ReactNode } from 'react';\n\n" +
    '/**\n * Greets one person.\n * @param props the person\n * @param props.name the name\n * @returns the greeting\n */\nexport function Greeting({ name }: Readonly<{ name: string }>): ReactNode {\n    return <p>{name}</p>;\n}\n';
