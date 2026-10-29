import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';

export const GENERATED_BASH_FILES = {
    'gspot.toml': 'configurations = ["bash"]\n[rules]\nenabled = false\n',
    'run.sh': '#!/usr/bin/env bash\necho ok\n',
    '.gitignore': `${GSPOT_PATHS.state}/\n`,
};
