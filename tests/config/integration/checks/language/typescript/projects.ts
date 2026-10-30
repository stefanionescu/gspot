import { BASE_INSTALLED_FILES } from '#tests/config/integration/checks/samples.ts';

export const AUTHORED_TSCONFIG = `{
    // The application owns its build and module settings.
    "compilerOptions": {
        "strict": false,
        "target": "ES2020",
        "module": "ESNext",
        "moduleResolution": "Bundler",
        "types": [],
        "incremental": true,
        "tsBuildInfoFile": %BUILD_INFO%
    },
    "include": ["src"],
}\n`;

export const OUTDIR_CASES = [
    { name: 'an absolute outDir outside the project writes no output', kind: 'absolute' },
    { name: 'an outDir through a linked node_modules writes nothing outside the repository', kind: 'symlink' },
] as const;

export const IMPLICIT_PROJECT_FILES = {
    '.gitignore': 'node_modules/\n.gspot/\n',
    'tsconfig.json': '{"compilerOptions":{"strict":true,"types":[]}}\n',
    'src/clean.ts': 'export const count: number = 1;\n',
    'src/broken.ts': 'export const count: number = "wrong";\n',
} as const;

export const TYPESCRIPT_PROJECTS_SANDBOX = {
    install: false,
    configurations: ['typescript'],
    level: 'all',
    files: BASE_INSTALLED_FILES,
} as const;
