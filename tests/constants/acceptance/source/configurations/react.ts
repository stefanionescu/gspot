// The literal values acceptance/source/configurations/react reads: names, patterns, limits, and tables.

export const NATIVE_DEPENDENCIES = { expo: '54.0.0', react: '19.1.1', 'react-native': '0.81.4' };
export const WEB_DEPENDENCIES = { react: '19.1.1', 'react-dom': '19.1.1' };
export const NATIVE_TSCONFIG =
    '{\n    "compilerOptions": {\n        "strict": true,\n        "noFallthroughCasesInSwitch": true,\n        "noUncheckedIndexedAccess": true,\n        "noImplicitOverride": true,\n        "exactOptionalPropertyTypes": true,\n        "target": "ES2022",\n        "module": "ESNext",\n        "moduleResolution": "Bundler",\n        "types": [],\n        "skipLibCheck": true,\n        "jsx": "react-jsx"\n    },\n    "include": ["src"]\n}\n';
export const WEB_TSCONFIG =
    '{\n    "compilerOptions": {\n        "strict": true,\n        "noFallthroughCasesInSwitch": true,\n        "noUncheckedIndexedAccess": true,\n        "noImplicitOverride": true,\n        "exactOptionalPropertyTypes": true,\n        "target": "ES2022",\n        "module": "ESNext",\n        "moduleResolution": "Bundler",\n        "types": [],\n        "skipLibCheck": true,\n        "jsx": "react-jsx",\n        "lib": ["DOM", "ES2022"]\n    },\n    "include": ["src"]\n}\n';
export const REPORT = '.gspot/reports/report.json';
export const TESTED =
    "// A planted test.\nimport { render, screen } from '@testing-library/react';\n\nrender(<p>hello</p>);\nscreen.getByText('hello');\n";
