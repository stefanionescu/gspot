import { OFFLINE_ENVIRONMENT } from '#tests/config/setup/programs.ts';
import { prepareRunFolders } from '#tests/setup/runner/run-folder.ts';
import { overrideEnvironment } from '#tests/setup/system/environment.ts';

// The files of a unit run share this process, so the overrides must outlive each file.
// The test task removes the run folder.
const resources = new AsyncDisposableStack();

await prepareRunFolders(resources);
resources.use(
    overrideEnvironment({ ...OFFLINE_ENVIRONMENT, CI: undefined, GITHUB_ACTIONS: undefined, TERM: 'xterm-256color' }),
);
