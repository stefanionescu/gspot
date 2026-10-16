export const BASH_MANIFEST = '[configuration]\nname = "bash"\n';

export const PACKAGE_FOLDER = 'workspace % café';

export const ASSET_READER_SCRIPT = `import { readAsset, listAssets } from './packages/cli/src/system/assets.ts';
console.log(JSON.stringify({ text: readAsset('configurations/language/bash/manifest.toml'), files: listAssets('configurations') }));
`;

// Authored marker cases cover every malformed delimiter layout in both supported file formats.
export const BLOCK_FORMATS = [
    {
        path: 'AGENTS.md',
        style: 'markdown',
        start: '<!-- >>> gspot managed >>> -->',
        end: '<!-- <<< gspot managed <<< -->',
    },
    { path: '.gitignore', style: 'hash', start: '# >>> gspot managed >>>', end: '# <<< gspot managed <<<' },
] as const;

export const MALFORMED_BLOCKS = [
    { path: 'AGENTS.md', style: 'markdown' as const, source: '<!-- >>> gspot managed >>> -->\nbody\n' },
    { path: 'AGENTS.md', style: 'markdown' as const, source: 'body\n<!-- <<< gspot managed <<< -->\n' },
    {
        path: 'AGENTS.md',
        style: 'markdown' as const,
        source: `<!-- <<< gspot managed <<< -->
body
<!-- >>> gspot managed >>> -->
`,
    },
    {
        path: 'AGENTS.md',
        style: 'markdown' as const,
        source: `<!-- >>> gspot managed >>> -->
<!-- >>> gspot managed >>> -->
body
<!-- <<< gspot managed <<< -->
`,
    },
    {
        path: 'AGENTS.md',
        style: 'markdown' as const,
        source: `<!-- >>> gspot managed >>> -->
body
<!-- <<< gspot managed <<< -->
<!-- <<< gspot managed <<< -->
`,
    },
] as const;

export const OUTSIDE_PATTERNS = [
    '../outside/**',
    'src/../../outside.ts',
    '/etc/**',
    'C:/Windows/**',
    '!../outside/**',
    '{src,../outside}/**',
    'src/{..,nested}/*.ts',
] as const;

export const PACKAGE_FOLDER_FILES = {
    'packages/cli/configurations/.index.json': '{}',
    'packages/cli/configurations/language/bash/.meta/state.json': '{}',
} as const;

export const LINKED_MISE_FOLDERS = [
    { link: '.config', target: '../outside', pattern: '.config/sub/*.toml' },
    { link: '.config/sub', target: '../../outside/sub', pattern: '.config/sub/*.toml' },
    { link: '.config', target: '../outside', pattern: '.config/sub/tool.toml' },
] as const;
