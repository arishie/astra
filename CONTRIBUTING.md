# Contributing to Astra

Thank you for your interest in contributing to Astra! This document provides guidelines and instructions for contributing.

## Getting Started

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/astra.git
   cd astra
   ```
3. Run the setup script:
   ```bash
   chmod +x setup.sh && ./setup.sh
   ```

## Development Workflow

### Branch Naming

- `feature/` - New features (e.g., `feature/voice-integration`)
- `fix/` - Bug fixes (e.g., `fix/memory-leak`)
- `docs/` - Documentation updates
- `refactor/` - Code refactoring
- `test/` - Test additions/updates

### Making Changes

1. Create a new branch from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes and ensure:
   - Code follows the existing style
   - All tests pass: `npm test`
   - TypeScript compiles: `npm run typecheck`
   - No linting errors: `npm run lint`

3. Write meaningful commit messages:
   ```
   feat: add voice recognition support

   - Integrate ElevenLabs API
   - Add voice-to-text worker
   - Update documentation
   ```

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run security tests only
npm run test:security

# Watch mode for development
npm run test:watch
```

### Code Style

- Use TypeScript strict mode
- Prefer `const` over `let`
- Use meaningful variable names
- Add JSDoc comments for public APIs
- Keep functions small and focused

## Pull Request Process

1. Update documentation if needed
2. Add tests for new functionality
3. Ensure CI passes
4. Request review from maintainers
5. Address feedback promptly

### PR Title Format

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `refactor:` - Code refactoring
- `test:` - Test updates
- `chore:` - Maintenance tasks

## Reporting Issues

When reporting issues, please include:

1. Description of the problem
2. Steps to reproduce
3. Expected vs actual behavior
4. Environment details (OS, Node version, etc.)
5. Relevant logs or error messages

## Security Vulnerabilities

If you discover a security vulnerability, please do NOT open a public issue. Instead, email the maintainers directly.

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Help others learn and grow
- Focus on the project goals

## Questions?

Open a discussion on GitHub or reach out to the maintainers.

Thank you for contributing!
