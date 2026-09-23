/** Read ShellCheck rule directives without executing configuration or resolving source paths. */
export function shellcheckRules(text: string): { enable: string[]; disable: string[] } {
    const rules = { enable: [] as string[], disable: [] as string[] };
    for (const [index, line] of text.split(/\r?\n/u).entries()) {
        let remaining = line.trimStart();
        while (remaining !== '' && !remaining.startsWith('#')) {
            const directive = /^([a-zA-Z-]+)=/u.exec(remaining);
            const key = directive?.[1];
            if (directive === null || key === undefined)
                throw new Error(`Invalid ShellCheck directive on line ${index + 1}.`);
            remaining = remaining.slice(directive[0].length);
            const quote = remaining.slice(0, 1);
            const quoted = quote === '"' || quote === "'";
            const end = quoted
                ? remaining.indexOf(quote, 1)
                : remaining.search(key === 'enable' || key === 'disable' ? /[\s#]/u : /\s/u);
            if (quoted && end < 0) throw new Error(`Unterminated ShellCheck quote on line ${index + 1}.`);
            if (quoted && end === 1) throw new Error(`Empty ShellCheck quote on line ${index + 1}.`);
            const value = remaining.slice(quoted ? 1 : 0, end < 0 ? undefined : end);
            remaining = end < 0 ? '' : remaining.slice(end + (quoted ? 1 : 0)).trimStart();
            if (key === 'enable' || key === 'disable') {
                const entries = value === '' ? [] : value.split(',');
                const pattern = key === 'enable' ? /^[a-zA-Z-]+$/u : /^(?:all|(?:SC)?\d+(?:-(?:SC)?\d+)?)$/u;
                if (entries.some((entry) => !pattern.test(entry)))
                    throw new Error(`Invalid ShellCheck ${key} list on line ${index + 1}.`);
                rules[key].push(
                    ...entries.map((entry) =>
                        key === 'disable'
                            ? entry.replace(/(?:SC)?(\d+)/gu, (_, code: string) => `SC${Number(code)}`)
                            : entry,
                    ),
                );
            }
        }
    }
    return rules;
}
