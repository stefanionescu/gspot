export type ToolAdvisory = { id: string; aliases?: string[] | undefined };

export type ToolAdvisoryPackage = {
    package: { name: string; version: string };
    vulnerabilities?: ToolAdvisory[] | undefined;
};

export type ToolAdvisoryResult = {
    source: { path: string };
    packages: ToolAdvisoryPackage[];
};

export type ToolAdvisoryReport = { results?: ToolAdvisoryResult[] | undefined };
