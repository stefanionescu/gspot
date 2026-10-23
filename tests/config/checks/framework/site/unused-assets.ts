export const SCOPE_ASSET_FILES = {
    'README.md': '![Logo](docs/assets/logo.svg#light)\n![Other logo](other/assets/unused.svg)\n',
    'docs/assets/logo.svg': '<svg/>',
    'docs/assets/unused.svg': '<svg/>',
    'other/assets/unused.svg': '<svg/>',
} as const;

export const ASSET_REFERENCE_CASES = [
    ['index.html', '<img src="assets/logo.svg">'],
    ['Logo.tsx', '<img src="assets/logo.svg" />'],
] as const;
