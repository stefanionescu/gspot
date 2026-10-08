export const REFERENCE_FILES = {
    'next-env.d.ts': '/// <reference types="next" />\n',
    'worker-configuration.d.ts': '/// <reference types="@cloudflare/workers-types" />\n',
    'handwritten.d.ts': '/// <reference types="next" />\n',
    'app/next-env.d.ts': '/// <reference types="next" />\n',
    'app/worker-configuration.d.ts': '/// <reference types="@cloudflare/workers-types" />\n',
    'app/handwritten.d.ts': '/// <reference types="@cloudflare/workers-types" />\n',
};

export const GENERATED_SELECTIONS = [
    { configurations: ['nextjs', 'cloudflare'], tables: '', generated: ['next-env.d.ts', 'worker-configuration.d.ts'] },
    {
        configurations: ['javascript'],
        tables: '[scope."app"]\nconfigurations = ["nextjs", "cloudflare"]',
        generated: ['app/next-env.d.ts', 'app/worker-configuration.d.ts'],
    },
    { configurations: ['javascript'], tables: '', generated: [] },
    {
        configurations: ['nextjs', 'cloudflare'],
        tables: '[scope."app"]',
        generated: ['next-env.d.ts', 'worker-configuration.d.ts', 'app/next-env.d.ts', 'app/worker-configuration.d.ts'],
    },
    {
        configurations: ['nextjs', 'cloudflare'],
        tables: '[scope."app"]\nremoved_configurations = ["nextjs", "cloudflare"]',
        generated: ['next-env.d.ts', 'worker-configuration.d.ts'],
    },
];
