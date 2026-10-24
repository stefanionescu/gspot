export const INVALID_CSS = `a {
    invalid-property: 1;
}
`;

/**
The init plan note of a shared file that keeps a tool's settings.

@param tool the tool whose settings stay, such as sqlfluff.
@param section the heading of those settings in the shared file, which defaults to the tool.
@returns the plan note that asks you to delete the kept settings.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: 5 calls in 2 files share it.
export function buildRetainedNote(tool: string, section = tool): string {
    return `${section} settings stay here, and the generated ${tool} config file takes over. Delete the section; the generated config file replaces it.`;
}
