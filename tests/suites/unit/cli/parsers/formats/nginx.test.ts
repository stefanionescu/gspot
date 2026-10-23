import { test, expect } from 'bun:test';
import { parseNginxDirectives } from '#cli/parsers/formats/nginx.ts';
import { NGINX_DIRECTIVE_CASES } from '#tests/config/parsers/formats/nginx.ts';

test.each([...NGINX_DIRECTIVE_CASES])(
    'parseNginxDirectives splits $source into directives and arguments',
    ({ source, expected }) => {
        expect(parseNginxDirectives(source)).toStrictEqual(expected);
    },
);
