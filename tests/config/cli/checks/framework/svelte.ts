export const SCANNERS = {
    windows: { path: '.gspot/node_modules/.bin/svelte-check.cmd', body: '@echo VERSION\r\n' },
    posix: { path: '.gspot/node_modules/.bin/svelte-check', body: '#!/bin/sh\nprintf "VERSION\\n"\n' },
};

export const PROJECTS = [
    {
        name: 'root JavaScript',
        scope: '',
        policy: 'configurations = ["svelte"]\n[scope."app"]\n',
        target: undefined,
    },
    {
        name: 'scoped TypeScript',
        scope: 'app',
        policy: 'configurations = ["svelte", "typescript"]\n[scope."app"]\n',
        target: '.gspot/config/app/tsconfig.json',
    },
];

/** Native diagnostics with errors, warnings, and source locations. */
export const LINES =
    '1758823456789 START "/repo"\n1758823456790 {"type":"ERROR","filename":"src/Count.svelte","start":{"line":1,"character":10},"end":{"line":1,"character":15},"message":"Type \'string\' is not assignable to type \'number\'.","code":2322,"source":"ts"}\n1758823456791 {"type":"WARNING","filename":"src/Product.svelte","start":{"line":4,"character":0},"end":{"line":4,"character":20},"message":"`<img>` element should have an alt attribute","code":"a11y_missing_attribute","source":"svelte"}\n1758823456792 COMPLETED 2 FILES 1 ERRORS 1 WARNINGS 2 FILES_WITH_PROBLEMS';
