export const FASTAPI_SOURCE = `from fastapi import HTTPException

def lookup():
    try:
        return load_user()
    except ValueError as error:
        raise HTTPException(status_code=500, detail=str(error)) from error
`;

export const FASTAPI_CONFIGURATION_CASES = [
    {
        rule: 'cors-wildcard-with-credentials',
        source: 'app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True)\n',
        fixed: 'app.add_middleware(CORSMiddleware, allow_origins=["https://example.test"], allow_credentials=True)\n',
    },
    { rule: 'debug-enabled', source: 'app = FastAPI(debug=True)\n', fixed: 'app = FastAPI(debug=False)\n' },
] as const;
