# Nexus Life Coach - Deployment Guide

## Overview

This guide covers deploying the Nexus Life Coach application to Android and Windows platforms using the new cross-platform architecture.

## Prerequisites

### Development Environment
- Node.js 18+ 
- npm or yarn
- Git
- VS Code (recommended)

### Mobile Development
- React Native CLI
- Expo CLI
- Android Studio (for Android development)
- Visual Studio 2022 (for Windows development)

### Accounts
- Google Play Developer account (for Android)
- Microsoft Partner Center account (for Windows)
- Supabase project (already configured)

## Project Structure

```
nexus-create-world-main/
├── src/                          # Web application source
│   ├── core/                     # Shared business logic
│   ├── application/              # Web-specific application layer
│   └── components/               # Web components
├── mobile/                       # React Native application
│   ├── app/                      # Expo app structure
│   ├── src/                      # Mobile-specific source
│   └── shared/                   # Shared modules
└── deployment/                   # Deployment configurations
```

## Web Deployment

### Build for Production

```bash
# Install dependencies
npm install

# Build web application
npm run build

# Preview build
npm run preview
```

### Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

### Environment Variables

Set these in your deployment platform:

```bash
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_key
VITE_SUPABASE_PROJECT_ID=your_project_id
```

## Android Deployment

### Setup

```bash
# Navigate to mobile directory
cd mobile

# Install dependencies
npm install

# Install Expo CLI
npm install -g @expo/cli
```

### Development Build

```bash
# Start development server
npm start

# Run on Android device/emulator
npm run android
```

### Production Build

```bash
# Build for Android
expo build:android

# Options:
# - apk: For direct installation
# - app-bundle: For Google Play Store
# - development-build: For testing
```

### Google Play Store Deployment

1. **Prepare App Bundle**
   ```bash
   expo build:android --type app-bundle
   ```

2. **Create Google Play Console Account**
   - Go to [Google Play Console](https://play.google.com/console)
   - Create developer account ($25 one-time fee)
   - Complete store listing

3. **Upload App Bundle**
   - Upload the generated `.aab` file
   - Complete store listing information
   - Set pricing and distribution
   - Submit for review

### App Store Requirements

- **App Icon**: 512x512px PNG
- **Feature Graphic**: 1024x500px JPEG
- **Screenshots**: At least 2 screenshots
- **Privacy Policy**: Link to privacy policy
- **Target API Level**: 33 (Android 13)
- **Content Rating**: Complete content rating questionnaire

## Windows Deployment

### Setup with Electron

```bash
# Install Electron dependencies
npm install --save-dev electron electron-builder

# Add to package.json
{
  "main": "public/electron.js",
  "homepage": "./",
  "scripts": {
    "electron": "electron .",
    "electron-pack": "electron-builder",
    "preelectron-pack": "npm run build"
  }
}
```

### Electron Configuration

Create `public/electron.js`:

```javascript
const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile('index.html');
}

app.whenReady().then(createWindow);
```

### Build for Windows

```bash
# Build web app first
npm run build

# Package for Windows
npm run electron-pack
```

### Microsoft Store Deployment

1. **Prepare Desktop App**
   ```bash
   # Convert to Windows App Package
   electron-windows-store --convert-from dist
   ```

2. **Microsoft Partner Center**
   - Go to [Microsoft Partner Center](https://partner.microsoft.com/dashboard)
   - Create developer account
   - Reserve app name
   - Complete app certification

3. **Submit for Certification**
   - Upload app package
   - Complete store listing
   - Submit for review

## Continuous Integration/Deployment

### GitHub Actions Setup

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy Nexus Life Coach

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run build
      - uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.PROJECT_ID }}

  android:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: cd mobile && npm ci
      - run: cd mobile && expo build:android --non-interactive
        env:
          EXPO_ANDROID_KEYSTORE_BASE64: ${{ secrets.EXPO_ANDROID_KEYSTORE_BASE64 }}
          EXPO_ANDROID_KEYSTORE_ALIAS: ${{ secrets.EXPO_ANDROID_KEYSTORE_ALIAS }}
          EXPO_ANDROID_KEYSTORE_PASSWORD: ${{ secrets.EXPO_ANDROID_KEYSTORE_PASSWORD }}
          EXPO_ANDROID_KEY_PASSWORD: ${{ secrets.EXPO_ANDROID_KEY_PASSWORD }}
```

## Environment Configuration

### Development Environment

```bash
# .env.development
VITE_SUPABASE_URL=https://your-dev-supabase.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-dev-key
VITE_ENVIRONMENT=development
```

### Production Environment

```bash
# .env.production
VITE_SUPABASE_URL=https://your-prod-supabase.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-prod-key
VITE_ENVIRONMENT=production
```

## Security Considerations

### API Keys
- Never expose server-side keys in client code
- Use environment variables for sensitive data
- Implement proper authentication flow

### Data Protection
- Enable HTTPS in production
- Implement proper data validation
- Use secure storage for sensitive user data

### App Store Security
- Follow platform security guidelines
- Implement proper permission requests
- Handle user data according to privacy policies

## Performance Optimization

### Web Performance
- Enable gzip compression
- Implement service worker caching
- Optimize bundle size with code splitting
- Use CDN for static assets

### Mobile Performance
- Optimize images for mobile
- Implement lazy loading
- Use native components when possible
- Test on various devices

### Monitoring
- Set up error tracking (Sentry)
- Monitor performance metrics
- Track user analytics
- Implement crash reporting

## Testing

### Web Testing
```bash
# Run unit tests
npm test

# Run E2E tests
npm run test:e2e

# Performance testing
npm run test:performance
```

### Mobile Testing
```bash
# Run mobile tests
cd mobile
npm test

# Device testing
expo start --device

# Build testing
expo build:android --type development-build
```

## Release Process

### Version Management
- Use semantic versioning (MAJOR.MINOR.PATCH)
- Update version numbers in all platforms
- Maintain changelog

### Release Checklist
- [ ] All tests passing
- [ ] Security audit completed
- [ ] Performance benchmarks met
- [ ] Documentation updated
- [ ] Store listing prepared
- [ ] Beta testing completed
- [ ] Final build tested

### Post-Release
- Monitor crash reports
- Track user feedback
- Update documentation
- Plan next release

## Troubleshooting

### Common Issues

**Build Failures**
- Check Node.js version compatibility
- Clear npm cache: `npm cache clean --force`
- Delete node_modules and reinstall

**Permission Errors**
- Check file permissions
- Run as administrator if needed
- Verify API key configurations

**Store Rejection**
- Review platform guidelines
- Fix policy violations
- Update privacy policy

**Performance Issues**
- Profile application performance
- Optimize bundle size
- Implement lazy loading

### Support Resources
- [React Native Documentation](https://reactnative.dev/docs/getting-started)
- [Expo Documentation](https://docs.expo.dev/)
- [Electron Documentation](https://www.electronjs.org/docs)
- [Google Play Console Help](https://support.google.com/googleplay/android-developer)
- [Microsoft Partner Center Help](https://docs.microsoft.com/en-us/windows/apps/windows-app-sdk/)
