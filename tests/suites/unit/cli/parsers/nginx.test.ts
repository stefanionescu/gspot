import { test, expect } from 'bun:test';
import { parseNginxDirectives } from '#cli/parsers/nginx.ts';
import { NGINX_DIRECTIVE_CASES } from '#tests/config/parsers/nginx.ts';

test.each([...NGINX_DIRECTIVE_CASES])(
    'parseNginxDirectives splits $source into directives and arguments',
    ({ source, expected }) => {
        expect(parseNginxDirectives(source)).toStrictEqual(expected);
    },
);
