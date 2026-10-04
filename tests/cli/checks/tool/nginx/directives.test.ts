import { test, expect } from 'bun:test';
import { directives } from '#cli/parsers/nginx.ts';
import type { DirectiveCase } from '#tests/types/cli/checks/tool/nginx.ts';

test.each([
    {
        source: 'location / { proxy_pass "https://api:3000"; add_header X-Value "two  spaces # text"; }',
        expected: [
            ['location', '/'],
            ['proxy_pass', 'https://api:3000'],
            ['add_header', 'X-Value', 'two  spaces # text'],
        ],
    },
    {
        source: 'set $empty ""; set $value ${upstream}; include /etc/tls#local.conf; # include /ignored;\n',
        expected: [
            ['set', '$empty', ''],
            ['set', '$value', '${upstream}'],
            ['include', '/etc/tls#local.conf'],
        ],
    },
    {
        source: String.raw`set $value "tab\tnewline\nreturn\rquote\"slash\\";`,
        expected: [['set', '$value', 'tab\tnewline\nreturn\rquote"slash\\']],
    },
] satisfies DirectiveCase[])(
    'nginx directive parsing preserves argument boundaries in $source',
    ({ source, expected }) => {
        expect(directives(source)).toStrictEqual(expected);
    },
);
