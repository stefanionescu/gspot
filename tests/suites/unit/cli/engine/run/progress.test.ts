import { expect, spyOn, test } from 'bun:test';

import { printProgress } from '#cli/engine/run/progress.ts';
import { setOutputOptions } from '#cli/system/terminal.ts';
import { overrideEnvironment } from '#tests/setup/system/environment.ts';
import { fakeTerminals } from '#tests/setup/system/fakes.ts';

test('terminal progress rewrites one status line, and a log prints only what runs past the interval', () => {
    const terminal: string[] = [];
    const log: string[] = [];
    setOutputOptions({ isJson: false, isVerbose: false });
    using _environment = overrideEnvironment({ NO_COLOR: undefined, TERM: 'xterm-256color' });
    for (const [isTerminal, lines] of [
        [true, terminal],
        [false, log],
    ] as const) {
        using _terminals = fakeTerminals([
            [process.stdout, true],
            [process.stderr, isTerminal],
        ]);
        using _write = spyOn(process.stderr, 'write').mockImplementation((chunk) => {
            lines.push(String(chunk));
            return true;
        });
        const place = { total: 3, comparison: null };
        printProgress({ ...place, kind: 'finished', check: 'bash/shfmt', scope: '', duration: 1200, finished: 1 });
        printProgress({
            ...place,
            kind: 'running',
            running: [
                { check: 'python/ruff', scope: 'api' },
                { check: 'javascript/eslint', scope: '' },
            ],
            elapsed: 10_000,
            finished: 1,
        });
        printProgress({
            ...place,
            kind: 'finished',
            check: 'python/ruff',
            scope: 'api',
            duration: 12_300,
            finished: 2,
        });
    }
    expect(terminal).toHaveLength(3);
    for (const line of terminal) expect(line).toStartWith('\r\u{1B}[2K');
    expect(log).toStrictEqual([
        'running  api  python/ruff and javascript/eslint  10.0s\n',
        'done  api  python/ruff  12.3s\n',
    ]);
});

test.each([{ TERM: 'dumb' }, { NO_COLOR: '1' }])(
    'a terminal with %p gets the plain progress lines, without control sequences',
    (environment) => {
        const lines: string[] = [];
        setOutputOptions({ isJson: false, isVerbose: false });
        using _environment = overrideEnvironment({ NO_COLOR: undefined, TERM: 'xterm-256color', ...environment });
        using _terminals = fakeTerminals([
            [process.stdout, true],
            [process.stderr, true],
        ]);
        using _write = spyOn(process.stderr, 'write').mockImplementation((chunk) => {
            lines.push(String(chunk));
            return true;
        });
        printProgress({
            kind: 'finished',
            check: 'python/ruff',
            scope: '',
            duration: 12_300,
            finished: 1,
            total: 1,
            comparison: null,
        });
        expect(lines).toStrictEqual(['done  python/ruff  12.3s\n']);
    },
);
