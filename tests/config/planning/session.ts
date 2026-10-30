import { GSPOT_FOLDER } from '#cli/config/files/gspot.ts';

export const SESSION_FILES = {
    'package.json': '{"private":true,"packageManager":"bun@1.2.3"}\n',
    'entry.js': 'export const target = 1;\n',
    [`${GSPOT_FOLDER}/.keep`]: '',
};
