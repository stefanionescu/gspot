const revision = process.env['GSPOT_DOCS_REVISION'];
if (revision !== undefined && !/^[a-f\d]{40}$/u.test(revision)) {
    throw new Error('GSPOT_DOCS_REVISION must be a full source commit ID.');
}

export const sourceRevision = revision ?? 'main';
