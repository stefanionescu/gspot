// The test React and React Native repositories: their packages, compiler options, and a clean component.
import testsPackage from '#tests/package.json' with { type: 'json' };
import { STRICT_COMPILER_OPTIONS } from '#tests/config/samples/typescript.ts';

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
export const NATIVE_TSCONFIG = {
    compilerOptions: { ...STRICT_COMPILER_OPTIONS, module: 'ESNext', moduleResolution: 'Bundler', jsx: 'react-jsx' },
    include: ['src'],
};

/** The compiler options of a test React web repository. */
export const WEB_TSCONFIG = {
    compilerOptions: {
        ...STRICT_COMPILER_OPTIONS,
        module: 'ESNext',
        moduleResolution: 'Bundler',
        jsx: 'react-jsx',
        lib: ['DOM', 'ES2022'],
    },
    include: ['src'],
};

/** A component accepted by the configured React rules. */
export const CLEAN_COMPONENT =
    "// A test component.\nimport type { ReactNode } from 'react';\n\n" +
    '/**\n * Greets one person.\n * @param props the person\n * @param props.name the name\n * @returns the greeting\n */\nexport function Greeting({ name }: Readonly<{ name: string }>): ReactNode {\n    return <p>{name}</p>;\n}\n';
