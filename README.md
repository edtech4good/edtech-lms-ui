# EdTech LMS UI

A comprehensive user interface for the Educational Technology Learning Management System, built with Angular 12. This is the main frontend application that provides a complete learning management experience for students, teachers, and administrators.

## 🚀 Features

- **Student Dashboard**: Interactive learning interface with progress tracking
- **Teacher Portal**: Comprehensive tools for lesson management and student monitoring
- **Administrative Panel**: School and curriculum management capabilities
- **Course Management**: Create, edit, and organize educational content
- **Assessment System**: Quizzes, tests, and evaluation tools
- **Progress Tracking**: Real-time student progress monitoring
- **File Management**: Upload and manage educational resources
- **Multi-language Support**: Internationalization ready
- **Responsive Design**: Mobile-friendly interface using Ant Design
- **Real-time Updates**: Live data synchronization

## 🛠️ Technology Stack

- **Framework**: Angular 12
- **UI Library**: Ant Design (ng-zorro-antd)
- **Charts**: ngx-charts (D3.js based)
- **State Management**: NgRx
- **Styling**: Less CSS
- **Authentication**: JWT with Auth0
- **Icons**: FontAwesome
- **Language**: TypeScript

## 📋 Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- EdTech LMS API running (see [edtech-lms-api](../edtech-lms-api))

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/edtech-lms-ui.git
cd edtech-lms-ui
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Configuration

Copy the example environment file and configure your settings:

```bash
cp src/environments/environment.example.ts src/environments/environment.ts
```

Edit `src/environments/environment.ts` with your configuration:

```typescript
export const environment = {
  production: false,
  API_URL: 'localhost:3000', // Your API server URL
  SCHEMA: 'http', // http or https
  s3Link: 'https://your-s3-bucket.s3.amazonaws.com',
  PAYLOAD_KEY: 'your-payload-key-here',
  ALG_KEY: 'your-alg-key-here',
  HASH_KEY: 'your-hash-key-here',
  REFRESH_PAYLOAD_KEY: 'your-refresh-payload-key-here',
  REFRESH_ALG_KEY: 'your-refresh-alg-key-here',
  REFRESH_HASH_KEY: 'your-refresh-hash-key-here',
  GRAMMARLY_CLIENT_ID: 'your-grammarly-client-id-here',
};
```

### 4. Start the Development Server

```bash
npm start
```

The application will be available at `http://localhost:4200`

## Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The app will automatically reload if you change any of the source files.

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory.

## Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

## Running end-to-end tests

Run `ng e2e` to execute the end-to-end tests via a platform of your choice. To use this command, you need to first add a package that implements end-to-end testing capabilities.

## 🏗️ Build for Production

```bash
# Build for production
npm run build

# Build for specific environment
ng build --configuration=production
ng build --configuration=staging
ng build --configuration=development
```

## 🧪 Testing

```bash
# Run unit tests
npm test

# Run tests with coverage
npm run test:cov

# Run linting
npm run lint
```

## 📝 Available Scripts

- `npm start` - Start development server
- `npm run build` - Build for production
- `npm run watch` - Start with file watching
- `npm test` - Run unit tests
- `npm run lint` - Run ESLint

## 🗂️ Project Structure

```
src/
├── app/
│   ├── modules/           # Feature modules
│   │   ├── auth/         # Authentication module
│   │   ├── dashboard/    # Dashboard components
│   │   ├── lesson/       # Lesson management
│   │   ├── question/     # Question management
│   │   ├── student/      # Student features
│   │   ├── teacher/      # Teacher features
│   │   └── ...
│   ├── services/         # API services
│   ├── models/          # TypeScript interfaces
│   ├── guards/          # Route guards
│   ├── interceptors/    # HTTP interceptors
│   └── shared/          # Shared components
├── assets/              # Static assets
└── environments/        # Environment configurations
```

## 🔧 Configuration

### Environment Files

The application supports multiple environments:

- `environment.ts` - Default/development
- `environment.prod.ts` - Production
- `environment.dev.ts` - Development server
- `environment.staging.ts` - Staging server

### API Integration

The UI connects to the EdTech LMS API. Make sure to:

1. Configure the correct API URL in your environment file
2. Set up proper authentication keys
3. Ensure CORS is configured on the API server

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details on how to contribute to this project.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

If you encounter any issues or have questions:

1. Check the [Issues](https://github.com/your-username/edtech-lms-ui/issues) page
2. Create a new issue if your problem isn't already reported
3. Join our community discussions

## 🙏 Acknowledgments

- Built with [Angular](https://angular.io/)
- UI components from [Ant Design](https://ng.ant.design/)
- Charts powered by [ngx-charts](https://swimlane.github.io/ngx-charts/)
- State management with [NgRx](https://ngrx.io/)
