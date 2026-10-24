import { setDefaultTimeout } from 'bun:test';
import { applyEnvironment } from '#tests/setup/system/environment.ts';
import { OFFLINE_ENVIRONMENT, UNIT_TEST_TIMEOUT_MILLISECONDS } from '#tests/config/setup/environment.ts';

setDefaultTimeout(UNIT_TEST_TIMEOUT_MILLISECONDS);

applyEnvironment(process.env, OFFLINE_ENVIRONMENT);
