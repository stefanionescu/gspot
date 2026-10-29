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

export const GLOB_ASSET_CASES = [
    {
        path: 'docs/pages/index.astro',
        text: "---\nconst images = import.meta.glob<ImageMetadata>('../assets/tools/*.svg', { eager: true, import: 'default' });\n---\n<img src={images[icon].src} />",
        unused: ['docs/assets/other.svg'],
    },
    {
        path: 'docs/pages/icons.ts',
        text: "const images = import.meta.glob(['/assets/tools/*.svg', '!/assets/tools/spare.svg']);",
        unused: ['docs/assets/other.svg', 'docs/assets/tools/spare.svg'],
    },
    {
        path: 'docs/pages/icons.vue',
        text: "<script setup>const images = import.meta.glob('../assets/tools/*.svg');</script>",
        unused: ['docs/assets/other.svg'],
    },
    {
        path: 'docs/pages/example.ts',
        text: "// import.meta.glob('../assets/tools/*.svg')\nconst example = \"import.meta.glob('../assets/tools/*.svg')\";",
        unused: ['docs/assets/other.svg', 'docs/assets/tools/logo.svg', 'docs/assets/tools/spare.svg'],
    },
] as const;
