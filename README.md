# QRganize Mobile App

<img src="src/assets/qrganize_icon.png" alt="QRganize Logo" width="150" align="right"/>

A mobile application built with Ionic and Angular for organizing moving boxes using QR codes.

## Features

- **QR Code Scanning**: Scan QR codes to quickly identify boxes
- **Box Management**: Create, edit, and delete moving boxes
- **Item Tracking**: Add items to boxes with descriptions and photos
- **Search Functionality**: Find items and boxes with powerful search
- **Image Capture**: Take photos of items directly from the app
- **Responsive UI**: Works on phones and tablets
- **Offline Support**: View your data even without internet connection
- **Dark Theme**: Eye-friendly dark mode interface

## Development Setup

### Prerequisites

- Node.js 18+
- Angular CLI: `npm install -g @angular/cli`
- Ionic CLI: `npm install -g @ionic/cli`
- Android Studio (for Android development)
- Xcode (for iOS development)

### Installation

```bash
# Install dependencies
npm install

# Generate resources (icons, splash screens)
npm run resources
```

### Development Server

```bash
# Start development server with browser auto-open
npm run start
```

### Building for Mobile

```bash
# Generate APK
npm run generate:apk
```

## Environment Configuration

The app uses environment files for different configurations:

1. Copy `src/environments/environment.sample.ts` to create:
   - `environment.ts` - Development environment
   - `environment.prod.ts` - Production environment
   - `environment.mobile.ts` - Mobile testing environment

## Project Structure

```
src/
├── app/                 # Application code
│   ├── components/      # Reusable components
│   ├── interceptors/    # HTTP interceptors
│   ├── screens/         # Application screens/pages
│   ├── shared/          # Shared services, models, and utilities
│   └── utils/           # Utility functions
├── assets/              # Static assets and images
├── environments/        # Environment configurations
└── theme/               # Global SCSS variables and themes
```

## Key Technologies

- **Ionic Framework 7**: UI components and mobile utilities
- **Angular 17**: Framework and routing
- **Capacitor**: Native device access
- **Firebase**: Authentication services
- **RxJS**: Reactive programming
- **@capacitor-community/barcode-scanner**: QR code scanning
- **@capacitor/camera**: Camera integration

## Testing

```bash
# Run unit tests
npm run test

# Run linting
npm run lint
```

## Contributing

Please ensure you follow the coding style guidelines and write tests for new features.

---

_This is the mobile client component of the QRganize system._
