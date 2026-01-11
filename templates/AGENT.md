# AI Agent Instructions

This file contains instructions for Claude when working on this repository.

## Project Overview

[Describe your project, its purpose, and key technologies used]

Example:
- **Name**: My Awesome Project
- **Purpose**: A web application for managing tasks
- **Stack**: TypeScript, React, Node.js, PostgreSQL
- **Architecture**: Monorepo with packages for frontend, backend, and shared code

## Code Patterns

### Architecture
[Document your architecture - e.g., MVC, Clean Architecture, etc.]

Example:
- Follow clean architecture principles
- Business logic in `src/domain/`
- Data access in `src/repositories/`
- API routes in `src/routes/`

### Naming Conventions
[Document naming conventions for files, functions, variables, etc.]

Example:
- Files: `kebab-case.ts`
- Classes: `PascalCase`
- Functions/Variables: `camelCase`
- Constants: `SCREAMING_SNAKE_CASE`

### Component Structure
[If applicable, describe component/module structure]

Example:
```
src/components/
├── Button/
│   ├── Button.tsx
│   ├── Button.test.tsx
│   ├── Button.styles.ts
│   └── index.ts
```

## Testing Requirements

### Unit Tests
- All new functions should have corresponding unit tests
- Use the project's testing framework for unit tests
- Aim for high coverage on new code

### Integration Tests
[Document when and how to write integration tests]

### Running Tests
```bash
npm test           # Run all tests
npm run test:unit  # Run unit tests only
npm run test:e2e   # Run e2e tests
```

## Commit Conventions

Follow conventional commits format:
- `feat:` New feature
- `fix:` Bug fix
- `refactor:` Code improvement without behavior change
- `test:` Testing additions
- `chore:` Maintenance/dependencies
- `docs:` Documentation

All AI commits should include the Co-Authored-By trailer as specified in the task prompt.

## Important Files

[List key files the AI should understand before making changes]

- `src/index.ts` - Main entry point
- `src/config/` - Configuration files
- `package.json` - Dependencies and scripts

## Constraints

[List any constraints or limitations]

- Do not modify files in `/vendor` or `/dist`
- Always use async/await over callbacks
- Do not add new dependencies without discussion
- Keep bundle size under X MB

## Validation Commands

Before committing, ensure these pass:
```bash
npm run typecheck  # Type checking
npm run lint       # Linting
npm test           # Tests
```

## Additional Notes

[Any other project-specific information]
