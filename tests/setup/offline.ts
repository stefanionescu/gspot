// Keeps the unit runner and its child tools offline for the life of this process.
import { OFFLINE_ENVIRONMENT } from '#tests/data/test-setup.ts';

for (const [name, value] of Object.entries(OFFLINE_ENVIRONMENT)) {
    if (value === undefined) Reflect.deleteProperty(process.env, name);
    else process.env[name] = value;
}
