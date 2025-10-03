# Contributing to EdTech LMS UI

Thank you for your interest in contributing to the EdTech LMS UI! This document provides guidelines and information for contributors.

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Angular CLI (v12 or higher)
- EdTech LMS API running locally

### Development Setup

1. Fork the repository
2. Clone your fork: `git clone https://github.com/your-username/edtech-lms-ui.git`
3. Install dependencies: `npm install`
4. Copy the example environment file: `cp src/environments/environment.example.ts src/environments/environment.ts`
5. Configure your environment variables in `src/environments/environment.ts`
6. Start the development server: `npm start`

## Code Style

This project uses:
- ESLint for code linting
- Angular Style Guide for code organization
- Less CSS for styling
- TypeScript for type safety

### Running Linting

```bash
# Run linting
npm run lint
```

## Testing

```bash
# Run unit tests
npm test

# Run tests with coverage
npm run test:cov
```

## Development Workflow

### Creating Components

Use Angular CLI to generate components:

```bash
# Generate a new component
ng generate component modules/feature-name/component-name

# Generate a new service
ng generate service services/service-name

# Generate a new module
ng generate module modules/feature-name
```

### Environment Configuration

When adding new environment variables:

1. Add the variable to `src/environments/environment.example.ts`
2. Add the variable to all environment files (dev, staging, prod)
3. Update the documentation

## Pull Request Process

1. Create a feature branch from `main`
2. Make your changes
3. Add tests for new functionality
4. Ensure all tests pass
5. Run linting and fix any issues
6. Update documentation if needed
7. Submit a pull request

### Pull Request Guidelines

- Use clear, descriptive commit messages
- Keep pull requests focused on a single feature or bug fix
- Include tests for new functionality
- Update documentation as needed
- Ensure your code follows Angular style guidelines
- Test your changes in multiple browsers

## Component Guidelines

### Naming Conventions

- Components: PascalCase (e.g., `StudentDashboardComponent`)
- Services: PascalCase with "Service" suffix (e.g., `AuthService`)
- Models/Interfaces: PascalCase (e.g., `StudentModel`)
- Constants: UPPER_SNAKE_CASE (e.g., `API_ENDPOINTS`)

### File Structure

```
src/app/modules/feature-name/
├── feature-name.component.ts
├── feature-name.component.html
├── feature-name.component.less
├── feature-name.component.spec.ts
└── feature-name-routing.module.ts
```

### Styling Guidelines

- Use Less CSS for component styles
- Follow BEM methodology for CSS class naming
- Use Ant Design components when possible
- Maintain responsive design principles

## API Integration

When working with the API:

1. Create services in the `src/app/services/` directory
2. Use proper error handling
3. Implement loading states
4. Add proper TypeScript interfaces for API responses

## Issue Reporting

When reporting issues, please include:

- Clear description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Browser and version information
- Screenshots if applicable
- Relevant error messages

## Security

If you discover a security vulnerability, please do not open a public issue. Instead, please contact the maintainers privately.

## License

By contributing to this project, you agree that your contributions will be licensed under the MIT License.

## Questions?

If you have questions about contributing, please open an issue or contact the maintainers.
