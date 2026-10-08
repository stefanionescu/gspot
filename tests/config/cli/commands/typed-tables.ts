export const REASON = 'Import the reviewed entrypoint for this dependency.';

export const TABLE = `[{name = "unreviewed-module", message = "${REASON}"}]`;

export const CHECK = ['check', '--only', 'docs/required-files', '--json'];
