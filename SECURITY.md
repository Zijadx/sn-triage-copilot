# Security Policy

## Credentials and secrets

This repo contains **no credentials, API keys, or passwords**.

All secrets are loaded from a `.env` file that is explicitly excluded from version control via `.gitignore`. A `.env.example` template with placeholder values is provided instead.

**Before contributing or forking:** Never commit a `.env` file or any file containing real credentials. If you accidentally commit a secret, rotate it immediately.

## Reporting a vulnerability

If you discover a security issue in this project, please open a private GitHub issue or email security@automatiki.com. Do not file a public issue for security vulnerabilities.

## Scope

This is a demonstration/portfolio project. It is not intended for production deployment without additional hardening:
- Input sanitization and rate limiting on the API
- Authentication on the `/api/triage` and `/api/logs` endpoints
- CORS locked to known origins in production
- Secrets managed via a proper secrets manager (AWS Secrets Manager, Vault, etc.)
