import { readFileSync } from 'node:fs';
import type { EngineInput } from '#types/run.ts';
import type { Finding } from '#types/finding.ts';
// django/settings: a settings module a deploy reads that turns DEBUG on, allows every host, or holds the secret key as text.
import { basename, dirname, join } from 'node:path';

// A module with one of these names holds values for one developer or for the tests, and no deploy reads it.
const LOCAL_MODULES = new Set(['local', 'dev', 'development', 'test', 'testing', 'tests', 'ci']);
const DEBUG_ON = /^DEBUG\s*=\s*True\b/u;
const EVERY_HOST = /^ALLOWED_HOSTS\s*=\s*\[[^\]]*["']\*["']/u;
const SECRET_AS_TEXT = /^SECRET_KEY\s*=\s*["'][^"']+["']/u;
const RULES: [RegExp, string, string][] = [
    [
        DEBUG_ON,
        'debug-on',
        'DEBUG is on in a settings module a deploy reads. Read it from the environment, off by default.',
    ],
    [EVERY_HOST, 'every-host', 'ALLOWED_HOSTS allows every host. Name the hosts, or read them from the environment.'],
    [SECRET_AS_TEXT, 'secret-as-text', 'SECRET_KEY is written as text. Read it from the environment.'],
];

// settings.py, or a module inside a settings package, under any name a deploy reads.
function isDeployed(path: string): boolean {
    const name = basename(path, '.py');
    const isSettings = name === 'settings' || basename(dirname(path)) === 'settings';
    return path.endsWith('.py') && isSettings && !LOCAL_MODULES.has(name);
}

/**
 * Settings a deploy reads that turn DEBUG on, allow every host, or hold the secret key as text.
 * @param input the engine input
 * @returns the findings
 */
export function djangoSettings(input: EngineInput): Promise<Finding[]> {
    const found = input.files
        .filter((file) => file.nature === 'source' && isDeployed(file.path))
        .flatMap((file) =>
            readFileSync(join(input.root, file.path), 'utf8')
                .split('\n')
                .flatMap((line, index) =>
                    RULES.flatMap(([pattern, rule, text]): Finding[] =>
                        pattern.test(line)
                            ? [
                                  {
                                      check: input.spec.id,
                                      file: file.path,
                                      line: index + 1,
                                      rule,
                                      message: text,
                                      fixable: false,
                                  },
                              ]
                            : [],
                    ),
                ),
        );
    return Promise.resolve(found);
}
