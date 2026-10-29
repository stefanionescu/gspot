export const RULES = {
    pathEncoding: 'path-encoding',
    absoluteLink: 'absolute-link',
    outwardLink: 'outward-link',
    encoding: 'encoding',
    size: 'size',
    trackedFile: 'tracked-file',
} as const;

export const ABSOLUTE_LINK_HELP = 'Use a relative link target inside the repository.';
export const OUTWARD_LINK_HELP = 'Replace the link with the file or folder it points to, or delete it.';
