# 🗽 NYC Safety Analysis App

A lightweight React Native app that provides on-demand safety analysis of NYC areas using real-time traffic camera feeds and AI-powered active cyclist detection.

## 🎯 **Key Features**

- **🚴‍♀️ Smart Cyclist Detection** - AI distinguishes between active cyclists vs parked bicycles
  - Detects people actively riding bicycles on sidewalks
  - Ignores parked/stationary bicycles for accurate safety assessment
- **🗺️ Camera Clustering** - Smart camera grouping by zoom level (like Craigslist)
  - Zoom out: Regional clusters showing camera counts
  - Zoom in: Individual cameras with live image access
- **📸 Camera Selection** - Click any camera to view live image and details
- **🎯 Batch Analysis** - Analyze multiple cameras in a cluster simultaneously
- **🗺️ Heat Map Visualization** - Color-coded risk overlays on map
- **⚡ Performance Optimized** - Only loads cameras for current map view
- **🔒 Manual Control** - Auto-analyze disabled by default (toggle available)

## 🛠️ **Setup Instructions**

### **CRITICAL: Run from correct directory**
```bash
cd test-safety-app
```
**⚠️ Must be in `test-safety-app` directory - NOT the root directory!**

### **Install Dependencies**
```bash
npm install
```

### **Start Development Server**
```bash
npx expo start --clear
```

### **Run on Device**
1. Install **Expo Go** app on your phone
2. Scan the QR code from the terminal
3. Grant location permissions when prompted

## 📱 **How to Use**

### **Initial Setup**
1. **Launch App** - Opens to NYC map with camera clusters
2. **Grant Location Permission** - Required for location-based features
3. **Wait for API Connection** - Status shows "✅ X Camera Groups"

### **Explore Cameras**
1. **Zoom & Pan** - Map shows clustered cameras by region
2. **Tap Clusters** - View individual cameras in that area or analyze all cameras in batch
3. **Select Camera** - Tap to see live image and details
4. **Analyze** - Use "🔍 Analyze This Camera" button for AI analysis

### **Analysis Options**
- **Auto-Analyze Toggle** - Off by default (top right)
- **Nearest Camera** - "🎯 Analyze Nearest Camera" button
- **Individual Camera** - Analyze any selected camera individually
- **Batch Analysis** - "🎯 Analyze All X Cameras" option for camera clusters
- **Heat Map** - View color-coded risk overlays on map

### **Navigation**
- **Live Map Tab** - Camera clustering and selection interface
- **Verify Tab** - Camera verification tools  
- **Settings Tab** - App configuration

## 🏗️ **Architecture**

### **Core Components**
- **NYC Camera API** - Real-time access to 938+ NYC traffic cameras
- **Moondream AI** - Advanced computer vision for object detection
- **React Native Maps** - Interactive map interface
- **Expo Location** - Precise user positioning

### **Data Flow**
1. **App Launch** → Get user location + test API connection
2. **User Request** → Find nearest camera within radius
3. **AI Analysis** → Process camera image with Moondream
4. **Results Display** → Show risk assessment and detection counts

## 🔧 **Technical Details**

### **API Integration**
- **NYC TMC API** - Official NYC traffic camera feed
- **Moondream AI** - Computer vision analysis service
- **Rate Limiting** - 2-second delays between AI requests
- **Caching** - 5-minute cache for camera data and analysis

### **Safety Scoring**
- **Risk Score** - 1-10 scale (1 = high risk, 10 = low risk)
- **Detection Factors** - Active cyclists, trucks, pedestrians, traffic density
- **Cyclist-Specific Scoring** - More severe penalties for active cyclists vs parked bikes
- **Confidence Levels** - Low, medium, high accuracy ratings

### **Performance Optimizations**
- **Lightweight Loading** - No bulk camera data downloads
- **On-Demand Processing** - Analysis only when requested
- **Efficient Caching** - Reduces redundant API calls
- **Background Queue** - Manages AI request rate limiting

## 🚨 **Troubleshooting**

### **Common Issues**

#### **App Won't Start**
```bash
# Make sure you're in the right directory
pwd  # Should show: .../test-safety-app

# Clear all caches
rm -rf .expo
rm -rf node_modules/.cache
npx expo start --clear --reset-cache
```

#### **Location Permission Denied**
- Go to phone Settings → Privacy → Location Services
- Enable for Expo Go app
- Restart the app

#### **API Connection Failed**
- Check internet connection
- Restart app to retry API connection
- NYC TMC API may be temporarily unavailable

#### **Analysis Button Disabled**
- Ensure location permission is granted
- Wait for "✅ Connected to NYC Cameras" status
- Check that you're in NYC area (or modify for testing)

### **Development Mode**
```bash
# Enable development logging
npx expo start --dev-client

# View logs in terminal
npx expo logs
```

## 📊 **Features Overview**

### **Current Capabilities**
- ✅ Real-time NYC camera access (938+ cameras)
- ✅ AI-powered active cyclist detection (distinguishes from parked bikes)
- ✅ Location-based nearest camera finding
- ✅ Risk assessment scoring with cyclist-specific penalties
- ✅ Interactive NYC map interface with camera clustering
- ✅ Batch analysis of multiple cameras simultaneously
- ✅ Heat map visualization with color-coded risk overlays
- ✅ Privacy-focused on-demand analysis
- ✅ Network resilience with comprehensive timeout handling
- ✅ Region-based camera loading for performance

### **Recent Enhancements**
- ✅ Smart cyclist vs parked bicycle detection using AI filtering
- ✅ Batch analysis dashboard for camera clusters
- ✅ Heat map visualization system
- ✅ Improved region detection (Manhattan/Brooklyn/Queens/Bronx)
- ✅ Camera cropping issue fixes with force reset capability
- ✅ Comprehensive error handling and network timeout recovery

## 🏙️ **NYC Integration**

### **Camera Coverage**
- **Manhattan** - High density coverage
- **Brooklyn** - Major intersections and bridges
- **Queens** - Key traffic corridors
- **Bronx** - Primary arterial roads
- **Staten Island** - Limited coverage

### **Data Sources**
- **NYC Department of Transportation** - Official camera feeds
- **NYC Traffic Management Center** - Real-time traffic data
- **Open Data NYC** - Public transportation datasets

## 🔐 **Privacy & Security**

- **No Data Storage** - Analysis results not permanently stored
- **Location Privacy** - GPS coordinates only used for nearest camera finding
- **On-Demand Only** - No background camera monitoring
- **Local Processing** - User location never sent to external APIs

## 📝 **Development Notes**

### **Key Dependencies**
```json
{
  "expo": "~53.0.12",
  "react-native-maps": "^1.20.1",
  "expo-location": "~18.1.0",
  "expo-camera": "~16.1.8"
}
```

### **Environment Requirements**
- **Node.js** 18+ 
- **Expo CLI** Latest version
- **iOS/Android** Device with location services
- **Internet** Required for NYC API and AI analysis

---

## 🚀 **Quick Start**

```bash
cd test-safety-app
npm install
npx expo start --clear
# Scan QR code with Expo Go app
```

**Ready to analyze NYC safety in real-time! 🗽✨**

## Original Expo Documentation

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

### Development Options

In the output, you'll find options to open the app in a:

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
