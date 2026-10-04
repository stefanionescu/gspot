/** Interpreter cases distinguish shell dialects from JavaScript runtime evidence. */
export const SHEBANG_CASES = [
    { name: 'Bash', source: '#!/usr/bin/env bash', tags: ['shell', 'executable', 'text', 'shebang:shell', 'bash'] },
    { name: 'POSIX shell', source: '#!/bin/sh', tags: ['shell', 'executable', 'text', 'shebang:shell', 'bash'] },
    { name: 'zsh', source: '#!/bin/zsh', tags: ['shell', 'executable', 'text', 'shebang:shell', 'zsh'] },
    { name: 'Bats', source: '#!/usr/bin/env bats', tags: ['shell', 'executable', 'text', 'shebang:shell', 'bats'] },
    {
        name: 'Bun',
        source: '#!/usr/bin/env -S bun run',
        tags: ['javascript', 'node', 'executable', 'text', 'shebang:node', 'runtime:bun'],
    },
    {
        name: 'Node.js',
        source: '#!/usr/bin/env node',
        tags: ['javascript', 'node', 'executable', 'text', 'shebang:node', 'runtime:node'],
    },
    {
        name: 'Deno',
        source: '#!/usr/bin/env deno',
        tags: ['javascript', 'node', 'executable', 'text', 'shebang:node', 'runtime:deno'],
    },
    { name: 'Python', source: '#!/usr/bin/python3', tags: ['python', 'executable', 'text', 'shebang:python'] },
    { name: 'plain text', source: 'plain text', tags: ['text'] },
];
