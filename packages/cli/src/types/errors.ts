/** What kind of failure a GspotError reports; the command layer maps it to output and an exit code. */
export type ErrorCode =
    | 'filesystem'
    | 'settings'
    | 'manifest'
    | 'arguments'
    | 'git'
    | 'files'
    | 'writing'
    | 'installation'
    | 'tool'
    | 'output'
    | 'skip'
    | 'pin'
    | 'template'
    | 'prompt';

/** A parsed value, or the error from its source. */
export type Parsed<T, E = string> = { value: T } | { error: E };
