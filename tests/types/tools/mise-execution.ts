export type MiseProject = {
    root: string;
    state: string;
    policy: string;
    generated: Buffer;
    environment: Record<string, string> & { PATH: string };
};
