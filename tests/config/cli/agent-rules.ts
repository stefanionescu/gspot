/** Configurations whose guidance includes the retained framework and library decisions. */
export const RULE_CONFIGURATIONS = [
    'typescript',
    'react-native',
    'nestjs',
    'postgres',
    'bash',
    'supabase',
    'zod',
    'html',
    'vue',
    'tanstack-query',
    'trpc',
    'nextjs',
    'drizzle',
];

/** Instructions retired because the selected configuration reports them as findings. */
export const CHECKED_RULE_LINES = [
    ['framework/react-native/REACT-NATIVE.md', 'Use `Pressable`'],
    ['framework/nestjs/NESTJS.md', 'forwardRef'],
    ['database/postgres/POSTGRES.md', 'Migration structure'],
    ['language/bash/BASH.md', 'bash.safety_owners'],
    ['platform/supabase/SUPABASE.md', '### Migration names'],
    ['library/zod/ZOD.md', 'Use `z.strictObject()`'],
    ['language/html/HTML.md', 'active-document data URLs'],
    ['framework/vue/VUE.md', 'Use the shorthand forms'],
    ['language/javascript/JAVASCRIPT.md', 'in place of `forEach`'],
    ['language/typescript/TYPESCRIPT.md', 'type tags stay out'],
] as const;

/** Primary upstream references retained by the selected native guidance. */
export const UPSTREAM_GUIDES = [
    ['library/tanstack-query/TANSTACK-QUERY.md', 'https://tanstack.com/query/'],
    ['library/trpc/TRPC.md', 'https://trpc.io/docs/'],
    ['framework/nextjs/NEXTJS.md', 'https://nextjs.org/docs/'],
    ['library/drizzle/DRIZZLE.md', 'https://orm.drizzle.team/docs/'],
    ['library/zod/ZOD.md', 'https://zod.dev/'],
    ['general/prose/DOCS.md', 'https://diataxis.fr/'],
    ['general/prose/WRITING.md', 'https://developers.google.com/style'],
    ['general/prose/DOCS-CONTENT.md', 'https://developers.google.com/style/'],
    ['general/prose/DOCS-FORMAT.md', 'https://developers.google.com/style/'],
    ['general/prose/DOCS-SURFACES.md', 'https://clig.dev/'],
    ['general/prose/DOCS-MEDIA.md', 'https://www.w3.org/WAI/'],
] as const;

/** Runtime guidance keeps Node assumptions out of React Native and Expo applications. */
export const RUNTIME_RULE_CASES = [
    { runtime: 'deno', dependency: undefined, hasNode: false },
    { runtime: 'node', dependency: undefined, hasNode: true },
    { runtime: 'node', dependency: 'react-native', hasNode: false },
    { runtime: 'node', dependency: 'expo', hasNode: false },
] as const;
