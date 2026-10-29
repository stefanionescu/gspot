import { registerHooks, type ResolveFnOutput, type ResolveHookContext } from 'node:module';

function redirectPlugin(
    specifier: string,
    context: ResolveHookContext,
    next: (specifier: string, context?: Partial<ResolveHookContext>) => ResolveFnOutput,
): ResolveFnOutput {
    if (specifier !== '@gspothq/eslint-plugin') return next(specifier, context);
    const source = new URL('../src/plugin.ts', import.meta.url);
    return next(source.href, context);
}

registerHooks({ resolve: redirectPlugin });
