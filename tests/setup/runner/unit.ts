import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { mkdtemp } from 'node:fs/promises';
import { setDefaultTimeout } from 'bun:test';
import { TEST_RUN_FOLDER } from '#tests/setup/runner/run-folder.ts';
import { OFFLINE_ENVIRONMENT } from '#tests/config/setup/programs.ts';
import { overrideEnvironment } from '#tests/setup/system/environment.ts';

import {
    CACHE_FOLDER,
    TEMPORARY_FOLDER,
    GIT_ISOLATION_ENVIRONMENT,
    UNIT_TEST_TIMEOUT_MILLISECONDS,
} from '#tests/config/setup/sandboxes.ts';

setDefaultTimeout(UNIT_TEST_TIMEOUT_MILLISECONDS);

const cache = await mkdtemp(join(TEST_RUN_FOLDER, `${CACHE_FOLDER}-`));
const temporary = await mkdtemp(join(TEST_RUN_FOLDER, `${TEMPORARY_FOLDER}-`));
const environment = overrideEnvironment({
    ...OFFLINE_ENVIRONMENT,
    ...GIT_ISOLATION_ENVIRONMENT,
    XDG_CACHE_HOME: cache,
    TMPDIR: temporary,
});

process.once('exit', () => {
    environment[Symbol.dispose]();
    rmSync(cache, { recursive: true, force: true });
    rmSync(temporary, { recursive: true, force: true });
});
