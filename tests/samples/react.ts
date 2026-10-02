// The planted React and React Native repositories: their packages, compiler options, and a clean component.

/** The packages of a planted React Native repository. */
export const NATIVE_DEPENDENCIES = { expo: '54.0.0', react: '19.1.1', 'react-native': '0.81.4' };

/** The packages of a planted React web repository. */
export const WEB_DEPENDENCIES = { react: '19.1.1', 'react-dom': '19.1.1' };

/** The compiler options of a planted React Native repository. */
export const NATIVE_TSCONFIG =
    '{\n    "compilerOptions": {\n        "strict": true,\n        "noFallthroughCasesInSwitch": true,\n        "noUncheckedIndexedAccess": true,\n        "noImplicitOverride": true,\n        "exactOptionalPropertyTypes": true,\n        "target": "ES2022",\n        "module": "ESNext",\n        "moduleResolution": "Bundler",\n        "types": [],\n        "skipLibCheck": true,\n        "jsx": "react-jsx"\n    },\n    "include": ["src"]\n}\n';

/** The compiler options of a planted React web repository. */
export const WEB_TSCONFIG =
    '{\n    "compilerOptions": {\n        "strict": true,\n        "noFallthroughCasesInSwitch": true,\n        "noUncheckedIndexedAccess": true,\n        "noImplicitOverride": true,\n        "exactOptionalPropertyTypes": true,\n        "target": "ES2022",\n        "module": "ESNext",\n        "moduleResolution": "Bundler",\n        "types": [],\n        "skipLibCheck": true,\n        "jsx": "react-jsx",\n        "lib": ["DOM", "ES2022"]\n    },\n    "include": ["src"]\n}\n';

/** A planted test that renders through Testing Library. */
export const RENDERED_TEST =
    "// A planted test.\nimport { render, screen } from '@testing-library/react';\n\nrender(<p>hello</p>);\nscreen.getByText('hello');\n";

/**
 * A planted component file: the header comment and the React type import, then the text.
 * @param text the component
 * @returns the file
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Every planted component opens with the same header comment and import.
export const plantedComponent = (text: string): string =>
    `// A planted component.\nimport type { ReactNode } from 'react';\n\n${text}`;

/** A component every rule accepts. */
export const CLEAN_COMPONENT = plantedComponent(
    '/**\n * Greets one person.\n * @param props the person\n * @param props.name the name\n * @returns the greeting\n */\n// eslint-disable-next-line gspot/no-trivial-functions -- reason: React calls this component through its rendering API.\nexport function Greeting({ name }: Readonly<{ name: string }>): ReactNode {\n    return <p>{name}</p>;\n}\n',
).replace(
    'import type { ReactNode }',
    '// eslint-disable-next-line gspot/no-trivial-files -- reason: React requires this component module.\nimport type { ReactNode }',
);
