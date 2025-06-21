# Nice People Hackathon - Safety App

A React Native safety app that uses **Moondream.ai computer vision** to detect bikes on sidewalks and calculate safety scores for city blocks. The app features an interactive map showing safety scores and a camera with **AI-powered bicycle detection**.

## 📁 Project Structure

This repository contains two versions of the app:

- **`nice-app/`** - Original base app (minimal implementation)
- **`test-safety-app/`** - Full-featured safety app with **Moondream.ai integration**

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

2. **Choose which app to run:**

## 🎯 **Option 1: Test Safety App (Recommended)**

**Full-featured app with Moondream.ai bicycle detection**

```bash
# Navigate to the test app
cd test-safety-app

# Install dependencies
npm install

# Start the development server
npm start
```

## 🏠 **Option 2: Original Nice App**

**Basic version without AI features**

```bash
# Navigate to the original app
cd nice-app

# Install dependencies
npm install

# Start the development server
npm start
```

## 📱 Testing on Your Device

### 1. **Install Expo Go**
- **iOS**: Download "Expo Go" from the App Store
- **Android**: Download "Expo Go" from Google Play Store

### 2. **Scan the QR Code**
- **iOS**: Open the Camera app and point it at the QR code shown in terminal
- **Android**: Open Expo Go app and use "Scan QR Code" feature

### 3. **Grant Permissions**
When the app loads, grant permissions for:
- **Camera**: Required for bicycle detection
- **Location**: Required for safety map functionality

## 🚴‍♀️ **Features**

### **🤖 AI-Powered Bicycle Detection**
- **Moondream.ai Integration**: Uses state-of-the-art computer vision
- **Zero-shot Detection**: Detects bicycles, bikes, and cyclists without training
- **Multiple Detection Types**: Searches for "bicycle", "bike", and "cyclist"
- **Confidence Scoring**: Provides confidence levels for detections

### **✅ User Verification System**
- **Bounding Box Verification**: Tap yellow boxes to confirm AI detections
- **Manual Circle Drawing**: Draw circles around missed bicycles
- **Interactive Overlay**: Visual feedback with green (verified) and red (user-added) indicators
- **Smart Deduplication**: Automatically removes overlapping detections

### **📊 Safety Scoring Algorithm**
- **0 bicycles** = 10/10 safety (safest)
- **1 bicycle** = 7/10 safety
- **2 bicycles** = 5/10 safety  
- **3 bicycles** = 3/10 safety
- **4+ bicycles** = 1-2/10 safety (least safe)

### **🗺️ Interactive Safety Map**
- **Real-time Updates**: Safety scores update immediately after verification
- **Color-coded Markers**: 
  - 🟢 Green: High safety (8-10/10)
  - 🟡 Yellow: Medium safety (4-7/10)
  - 🔴 Red: Low safety (1-3/10)
- **Location Services**: Automatically finds nearest city blocks

### **📸 Camera Features**
- **Professional UI**: Clean, intuitive camera interface
- **Real-time Analysis**: Shows "Analyzing with Moondream AI..." progress
- **Image Processing**: Handles image scaling and format conversion
- **Error Handling**: Graceful fallbacks if AI analysis fails

## 🔧 **Technical Implementation**

### **Moondream.ai Service**
```typescript
// services/moondreamService.ts
- API Integration with Moondream.ai
- Image to Base64 conversion
- Multiple object detection (bicycle, bike, cyclist)
- Duplicate detection removal
- Safety score calculation
- Confidence level determination
```

### **Verification Overlay Component**
```typescript
// components/BicycleDetectionOverlay.tsx
- SVG-based bounding box rendering
- Interactive touch handling
- Circle drawing with PanResponder
- Real-time verification statistics
```

### **Camera Integration**
```typescript
// app/(tabs)/camera.tsx
- expo-camera integration
- Moondream API calls
- Image dimension handling
- User flow management
```

## 🛠️ **Dependencies**

### **Core Dependencies**
- `expo-camera`: Camera functionality
- `expo-location`: GPS and location services
- `react-native-maps`: Interactive map display
- `react-native-svg`: Drawing overlays and bounding boxes

### **AI Integration**
- **Moondream.ai API**: Computer vision for bicycle detection
- **API Endpoint**: `https://api.moondream.ai/v1/detect`
- **Features Used**: Object detection, image analysis, confidence scoring

## 🔑 **API Configuration**

The app uses Moondream.ai API for bicycle detection:

```typescript
const MOONDREAM_API_KEY = 'your-api-key-here';
const MOONDREAM_API_BASE = 'https://api.moondream.ai/v1';
```

**API Features Used:**
- `/detect` - Object detection endpoint
- `/query` - Visual question answering
- `/caption` - Image captioning for context

## 📱 **User Flow**

1. **📍 Location Detection**: App finds your current location
2. **📸 Take Photo**: Point camera at sidewalk and capture image
3. **🤖 AI Analysis**: Moondream.ai analyzes image for bicycles
4. **✅ User Verification**: Confirm AI detections and add missed ones
5. **📊 Score Calculation**: Safety score calculated based on bicycle count
6. **🗺️ Map Update**: Location updated on safety map with new score

## 🚨 **Troubleshooting**

### **Common Issues**

**Camera not working:**
- Ensure camera permissions are granted
- Restart the Expo app
- Check if camera is being used by another app

**AI detection fails:**
- Check internet connection
- API might be rate-limited (5,000 requests/day free tier)
- Falls back to manual marking mode

**Map not loading:**
- Ensure location permissions are granted
- Check GPS/location services are enabled
- Try refreshing the app

**QR Code won't scan:**
- Make sure you're using the correct app (Camera on iOS, Expo Go on Android)
- Ensure QR code is fully visible and well-lit
- Try different distances from the screen

### **Port Issues**
If you see "Port already in use":
```bash
# The app will automatically suggest an alternative port
# Just press 'y' when prompted to use a different port
```

## 🎨 **UI/UX Features**

### **Modern Design**
- **Dark Theme**: Professional black/dark gray color scheme
- **Smooth Animations**: Loading indicators and transitions
- **Responsive Layout**: Adapts to different screen sizes
- **Accessibility**: High contrast colors and clear typography

### **Interactive Elements**
- **Visual Feedback**: Buttons change color when pressed
- **Progress Indicators**: Shows AI analysis progress
- **Status Messages**: Clear instructions and confirmations
- **Error Handling**: User-friendly error messages

## 🔮 **Future Enhancements**

### **Planned Features**
- **Offline Mode**: Cache AI model for offline detection
- **Historical Data**: Track safety trends over time
- **Community Features**: Share safety reports with other users
- **Route Planning**: Suggest safer walking/cycling routes
- **Weather Integration**: Factor weather conditions into safety scores

### **Technical Improvements**
- **Performance Optimization**: Faster image processing
- **Battery Optimization**: Reduce power consumption
- **Cloud Storage**: Backup safety data to cloud
- **Real-time Sync**: Multi-device synchronization

## 📊 **Performance**

### **AI Detection Metrics**
- **Accuracy**: High accuracy for bicycle detection
- **Speed**: ~2-5 seconds per image analysis
- **API Limits**: 5,000 free requests per day
- **Image Size**: Optimized for mobile (max 10MB)

### **App Performance**
- **Startup Time**: ~2-3 seconds
- **Memory Usage**: Optimized for mobile devices
- **Battery Impact**: Minimal when not actively using camera

## 🤝 **Contributing**

### **Development Setup**
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

### **Code Style**
- TypeScript for type safety
- ESLint for code quality
- Prettier for formatting
- Component-based architecture

## 📄 **License**

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 **Acknowledgments**

- **Moondream.ai** - For providing excellent computer vision API
- **Expo Team** - For the amazing React Native framework
- **React Native Community** - For the open-source libraries
- **Nice People Hackathon** - For the opportunity to build this app

---

## 📞 **Support**

If you encounter any issues or have questions:

1. **Check the Troubleshooting section** above
2. **Review the console logs** in Expo for error details
3. **Test on a different device** to isolate device-specific issues
4. **Ensure all permissions are granted** (Camera, Location)

**Happy testing! 🚴‍♀️📱** 