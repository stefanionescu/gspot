import { DOT_GSPOT } from '#cli/config/gspot-folder.ts';

export const SESSION_FILES = {
    'package.json': '{"private":true,"packageManager":"bun@1.2.3"}\n',
    'entry.js': 'export const target = 1;\n',
    [`${DOT_GSPOT}/.keep`]: '',
};
