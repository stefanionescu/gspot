export const FASTAPI_SOURCE = `from fastapi import HTTPException

def lookup():
    try:
        return load_user()
    except ValueError as error:
        raise HTTPException(status_code=500, detail=str(error)) from error
`;
