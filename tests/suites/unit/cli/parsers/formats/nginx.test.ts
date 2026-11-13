import { expect, test } from 'bun:test';

import { parseNginxDirectives } from '#cli/parsers/formats/nginx.ts';

const NGINX_DIRECTIVE_CASES: Array<{ source: string; expected: Array<[string, ...string[]]> }> = [
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
];

test.each([...NGINX_DIRECTIVE_CASES])(
    'parseNginxDirectives splits $source into directives and arguments',
    ({ source, expected }) => {
        expect(parseNginxDirectives(source)).toStrictEqual(expected);
    },
);
