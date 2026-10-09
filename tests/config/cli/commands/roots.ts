/** Writing commands refuse an externally linked managed directory before changing authored files. */
export const LINKED_STORAGE_CASES = [
    {
        name: 'init refuses a symlinked managed directory without writing outside the configuration root',
        command: 'init',
        path: 'entry.sh',
        source: 'echo example\n',
        sentinel: 'authored\n',
        message: '.gspot',
        hasPolicy: false,
    },
    {
        name: 'a linked .gspot folder is refused without changing outside bytes',
        command: 'check',
        path: 'source.txt',
        source: 'input\n',
        sentinel: 'authored outside\n',
        message: 'Unsafe lifecycle parent',
        hasPolicy: true,
    },
];

export const STORAGE_COMMAND = 'console.log("Exact finding"); process.exitCode=1';
