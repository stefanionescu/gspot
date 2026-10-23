import { applyEnvironment } from '#tests/setup/system/environment.ts';
import { OFFLINE_ENVIRONMENT } from '#tests/config/setup/environment.ts';

applyEnvironment(process.env, OFFLINE_ENVIRONMENT);
