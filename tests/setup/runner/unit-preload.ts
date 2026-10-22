// Bun loads this file before each unit test file. It keeps the tests and their child processes offline.
import { OFFLINE_ENVIRONMENT } from '#tests/data/setup/sandboxes.ts';

for (const [name, value] of Object.entries(OFFLINE_ENVIRONMENT)) {
    if (value === undefined) Reflect.deleteProperty(process.env, name);
    else process.env[name] = value;
}
