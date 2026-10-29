function applyEnvironment(
    environment: Record<string, string | undefined>,
    changes: Readonly<Record<string, string | undefined>>,
): void {
    for (const [name, value] of Object.entries(changes)) {
        if (value === undefined) Reflect.deleteProperty(environment, name);
        else environment[name] = value;
    }
}

/**
Set environment variables for a test and restore them when the scope ends, even after a failure.
*/
export function overrideEnvironment(variables: Record<string, string | undefined>): Disposable {
    const previous = Object.fromEntries(Object.keys(variables).map((name) => [name, process.env[name]]));
    applyEnvironment(process.env, variables);
    return {
        // eslint-disable-next-line gspot/no-trivial-functions -- reason: `using` calls it when the scope ends.
        [Symbol.dispose]() {
            applyEnvironment(process.env, previous);
        },
    };
}
