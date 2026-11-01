import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { mkdtemp } from 'node:fs/promises';
import { setDefaultTimeout } from 'bun:test';
import { OFFLINE_ENVIRONMENT } from '#tests/config/setup/programs.ts';
import { overrideEnvironment } from '#tests/setup/system/environment.ts';
import { linkGrammars, TEST_RUN_FOLDER } from '#tests/setup/runner/run-folder.ts';

import {
    CACHE_FOLDER,
    TEMPORARY_FOLDER,
    GIT_ISOLATION_ENVIRONMENT,
    UNIT_TEST_TIMEOUT_MILLISECONDS,
} from '#tests/config/setup/sandboxes.ts';

setDefaultTimeout(UNIT_TEST_TIMEOUT_MILLISECONDS);

const cache = await mkdtemp(join(TEST_RUN_FOLDER, `${CACHE_FOLDER}-`));
const temporary = await mkdtemp(join(TEST_RUN_FOLDER, `${TEMPORARY_FOLDER}-`));
await linkGrammars(cache);
const environment = overrideEnvironment({
    ...OFFLINE_ENVIRONMENT,
    ...GIT_ISOLATION_ENVIRONMENT,
    CI: undefined,
    GITHUB_ACTIONS: undefined,
    TERM: 'xterm-256color',
    XDG_CACHE_HOME: cache,
    TMPDIR: temporary,
});

process.once('exit', () => {
    environment[Symbol.dispose]();
    rmSync(cache, { recursive: true, force: true });
    rmSync(temporary, { recursive: true, force: true });
});
