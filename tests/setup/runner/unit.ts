import { afterAll } from 'bun:test';
import { OFFLINE_ENVIRONMENT } from '#tests/config/setup/programs.ts';
import { prepareRunFolders } from '#tests/setup/runner/run-folder.ts';
import { overrideEnvironment } from '#tests/setup/system/environment.ts';

const resources = new AsyncDisposableStack();

afterAll(() => resources.disposeAsync());

await prepareRunFolders(resources);
resources.use(
    overrideEnvironment({ ...OFFLINE_ENVIRONMENT, CI: undefined, GITHUB_ACTIONS: undefined, TERM: 'xterm-256color' }),
);
