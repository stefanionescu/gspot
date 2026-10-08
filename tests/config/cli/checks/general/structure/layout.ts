/** Route files whose one-file folders require authored check ignores. */
export const ROUTE_CASES = [
    { framework: 'astro', name: 'index.ts', directory: 'src/pages', content: '' },
    { framework: 'astro', name: 'index.astro', directory: 'src/pages', content: '<main>Example</main>\n' },
    { framework: 'svelte', name: '+page.ts', directory: 'src/routes', content: '' },
    { framework: 'svelte', name: '+page.svelte', directory: 'src/routes', content: '<p>Example</p>\n' },
];
