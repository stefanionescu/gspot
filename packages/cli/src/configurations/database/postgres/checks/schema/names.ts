import { PUBLIC_SCHEMA } from '#cli/config/configurations/postgres.ts';

export function qualifyName(schema: string | undefined, name: string | undefined = ''): string {
    return `${schema === undefined || schema === '' ? PUBLIC_SCHEMA : schema}.${name}`;
}
