# Nice People Hackathon - Safety App

A React Native safety app that uses computer vision to detect bikes on sidewalks and calculate safety scores for city blocks. The app features an interactive map showing safety scores and a camera for real-time bike detection.

## 📁 Project Structure

This repository contains two versions of the app:

- **`nice-app/`** - Original base app (minimal implementation)
- **`test-safety-app/`** - Full-featured safety app with camera and map functionality

## 🚀 Getting Started

### Prerequisites

- Node.js (v16 or later)
- npm or yarn
- Expo CLI: `npm install -g @expo/cli`
- Expo Go app on your mobile device
  - **iOS**: Download from App Store
  - **Android**: Download from Google Play Store

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd nice-people-hackathon
   ```

## 📱 Running the Apps

### Option 1: Test Safety App (Recommended)

The **test-safety-app** is the full-featured version with all safety functionality.

```bash
# Navigate to the test app directory
cd test-safety-app

# Install dependencies
npm install

# Start the Expo development server
npm start
```

**Features:**
- 📷 Camera with bike detection simulation
- 🗺️ Interactive safety map with colored markers
- 📍 Location-based safety scoring
- 🏠 Home screen with app overview
- 🔍 Explore tab with app information

### Option 2: Original Nice App (Basic)

The **nice-app** is the original base version with minimal functionality.

```bash
# Navigate to the nice app directory
cd nice-app

# Install dependencies
npm install

# Start the Expo development server
npm start
```

**Features:**
- 🏠 Basic home screen
- 🔍 Explore tab
- 📱 Standard React Native navigation

## 📱 Testing on Your Phone

1. **Start the development server** (choose one app above)
2. **Scan the QR code** that appears in your terminal:
   - **iOS**: Use the Camera app
   - **Android**: Use the Expo Go app's scan feature
3. **Grant permissions** when prompted:
   - Camera access (for bike detection)
   - Location access (for safety map)

## 🎯 App Features (Test Safety App)

### Camera Tab
- Take photos to simulate bike detection
- View safety scores based on detected bikes
- Location-aware safety updates
- Real-time safety score calculation

### Safety Map Tab
- Interactive map with safety markers
- Color-coded safety levels:
  - 🟢 **Green**: Safe (7-10/10)
  - 🟡 **Yellow**: Moderate (4-6/10)
  - 🔴 **Red**: Unsafe (1-3/10)
- Tap markers for detailed safety information
- Your current location display

### Home Tab
- Welcome screen with app description
- Quick navigation to key features
- App overview and instructions

### Explore Tab
- General app information
- Feature explanations
- Usage guidelines

## 🛠️ Development

### Project Structure (Test Safety App)

```
test-safety-app/
├── app/
│   ├── (tabs)/
│   │   ├── index.tsx          # Home screen
│   │   ├── camera.tsx         # Camera functionality
│   │   ├── safety-map.tsx     # Interactive map
│   │   └── explore.tsx        # App information
│   └── _layout.tsx            # Main navigation
├── components/
│   ├── SafetyContext.tsx      # Shared safety data
│   ├── FallbackMap.tsx        # Map component
│   └── ...                    # UI components
└── assets/                    # Images and fonts
```

### Key Dependencies

- **expo-camera**: Camera functionality and permissions
- **react-native-maps**: Interactive maps
- **expo-location**: GPS and location services
- **@react-navigation**: Tab navigation

## 🔧 Troubleshooting

### Common Issues

1. **QR Code won't scan**
   - Ensure your phone and computer are on the same WiFi network
   - Try refreshing the QR code by restarting the server

2. **Camera permissions denied**
   - Go to your phone's Settings → Apps → Expo Go → Permissions
   - Enable Camera and Location permissions

3. **App won't load**
   - Pull down on the screen to refresh
   - Shake your phone to open developer menu and tap "Reload"

4. **Port conflicts**
   - If you see "Port 8081 is running", choose a different port (Y/n)
   - The app will automatically use an available port

### Starting Fresh

If you encounter issues, try:

```bash
# Kill any existing Expo processes
pkill -f expo

# Clear npm cache
npm cache clean --force

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Start fresh
npm start
```

## 📝 Development Notes

- The app uses **simulated bike detection** for demo purposes
- Safety scores are calculated based on detected bike count
- Map markers update in real-time when new photos are taken
- Location services provide context for safety scoring

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test on both iOS and Android
5. Submit a pull request

## 📄 License

This project is part of the Nice People Hackathon.

---

## 🆘 Need Help?

If you encounter any issues:
1. Check the troubleshooting section above
2. Ensure all prerequisites are installed
3. Verify your phone and computer are on the same network
4. Try restarting the Expo development server

**Happy coding! 🚀** 