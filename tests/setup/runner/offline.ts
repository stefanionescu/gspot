import { OFFLINE_ENVIRONMENT } from '#tests/config/setup/environment.ts';

for (const [name, value] of Object.entries(OFFLINE_ENVIRONMENT)) {
    if (value === undefined) Reflect.deleteProperty(process.env, name);
    else process.env[name] = value;
}
