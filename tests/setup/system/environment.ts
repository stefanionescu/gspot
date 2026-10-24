import { mock } from 'bun:test';
import * as systemEnvironment from 'std-env';

/**
Change a set of environment variables: a string sets a variable, and undefined removes it.

@param target the variables to change, such as process.env.
@param changes the values to set or remove.
*/
export function applyEnvironment(
    target: Record<string, string | undefined>,
    changes: Readonly<Record<string, string | undefined>>,
): void {
    for (const [name, value] of Object.entries(changes)) {
        if (value === undefined) Reflect.deleteProperty(target, name);
        else target[name] = value;
    }
}

/**
Set environment variables for a test and restore them when the scope ends, even after a failure.

@param variables values to set or clear for this scope.
@returns a resource that restores the old values.
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

/** Make the terminal look interactive and not CI, until the caller disposes the returned resource. */
export async function simulateInteractiveTerminal(): Promise<AsyncDisposable> {
    const resources = new AsyncDisposableStack();
    const previousEnvironment = { ...systemEnvironment };
    await mock.module('std-env', () => ({ ...previousEnvironment, isCI: false }));
    resources.defer(async () => {
        await mock.module('std-env', () => previousEnvironment);
    });
    for (const stream of [process.stdin, process.stdout]) {
        const descriptor = Object.getOwnPropertyDescriptor(stream, 'isTTY');
        Object.defineProperty(stream, 'isTTY', { configurable: true, value: true });
        resources.defer(() => {
            if (descriptor === undefined) Reflect.deleteProperty(stream, 'isTTY');
            else Object.defineProperty(stream, 'isTTY', descriptor);
        });
    }
    return resources;
}
