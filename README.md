# 🌟 Vibe-Check: AI-Orchestrated Urban Navigation Intelligence

**AI-powered street safety analysis for NYC pedestrians using real-time camera feeds, crowdsourced reporting, and dual AI intelligence (Gemini + Google Cloud Vision).**

## 🚀 **Live Demo**

**Try the app now:** [https://vibe-check-463816.web.app](https://vibe-check-463816.web.app)

📱 **Mobile QR Code:** Scan to test on your phone
```
█▀▀▀▀▀█ ▀▄▀▄█ █▄▀▀ █▀▀▀▀▀█
█ ███ █ ███▀▀█▄██▀█ █ ███ █
█ ▀▀▀ █ █▄█▀ ▀█▄▄▀█ █ ▀▀▀ █
▀▀▀▀▀▀▀ █▄█ █▄█ █ █ ▀▀▀▀▀▀▀
██ ▄█▀▀▀▄█▄█▀█▀▄██▀▀██▄▀▄ ▀
█▀▀▄▄ ▀ ▄▄▄ █▄▀▄▀██▄▄▄█▀▄██
██▄█▄▀▀█▀▄ ▄▀▄▄▀█▀▄█▀▀▀ ███
▀▀ ▀▀▀▀▀▀▄██▄▄▄▄▄█▀▀▀▀▀█▄▀▄
█▀▀▀▀▀█ █▄▄▀█▄ █▄▄ ▀ ███ ▀
█ ███ █ ▄▄▄▄ ▀█▄▀▀▀▀██▀▀▀██
█ ▀▀▀ █ █▄█ ▄█▄██▄▄▄▄▄ ▀▄ █
▀▀▀▀▀▀▀ ▀▀  ▀  ▀▀ ▀ ▀▀▀▀▀▀▀
```

## 🎯 **What It Does**

Vibe-Check analyzes NYC street scenes in real-time to help pedestrians avoid:
- 🚴‍♂️ **Sidewalk cycling chaos** - bikes where they shouldn't be
- 🚧 **Infrastructure bottlenecks** - blocked walkways and hazards  
- 👥 **Overcrowding hotspots** - dangerously crowded areas
- ⚠️ **Safety violations** - reported by community members

**Perfect for:** Urban pedestrians, accessibility users, tourists, city planners, and safety researchers.

## 🧠 **AI-Powered Intelligence**

### **Dual AI Analysis Pipeline**
- **🤖 Gemini AI**: Contextual scene understanding and safety recommendations
- **👁️ Google Cloud Vision**: Object detection (vehicles, pedestrians, cyclists)
- **🔗 Combined Intelligence**: Enhanced analysis merging both AI systems

### **Data Sources (No Vision Required)**
- **🕒 Time-based factors**: Rush hour, weekend patterns, night safety
- **🌤️ Weather conditions**: Real-time weather impact on safety
- **🏗️ Infrastructure data**: Bike lanes, traffic signals, school zones
- **📊 Historical data**: Accident history, crime statistics, traffic patterns
- **🚦 Real-time traffic**: Current congestion and vehicle speeds

## 🏗️ **System Architecture**

```
┌─────────────────────────────────────────────────────────────┐
│                    🌐 Angular Frontend                      │
│  Dashboard • Analysis Interface • Territory Map • Reporting │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                🔥 Firebase Backend                         │
│     Cloud Functions • Firestore • Storage • Hosting       │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                🤖 AI Intelligence Layer                    │
│     Gemini API • Google Cloud Vision • Moondream API       │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                📡 Data Sources                             │
│  NYC TMC Cameras • Weather • Traffic • NYC Open Data       │
└─────────────────────────────────────────────────────────────┘
```

## 🛠️ **Tech Stack**

### **Frontend**
- **Angular 20** (Zoneless, SSR/SSG)
- **Google Maps API** (Territory visualization)
- **Progressive Web App** (Mobile-optimized)
- **TypeScript** (Type-safe development)

### **Backend**
- **Firebase Cloud Functions** (Serverless API)
- **Firestore Database** (Real-time data)
- **Firebase Storage** (Image uploads)
- **Node.js + TypeScript** (Server logic)

### **AI & APIs**
- **Google Gemini API** (Primary intelligence)
- **Google Cloud Vision API** (Object detection)
- **Moondream API** (Legacy vision analysis)
- **NYC TMC API** (Live camera feeds)
- **OpenWeather API** (Weather data)

## 🚀 **Quick Start**

### **1. Clone & Install**
```bash
git clone https://github.com/GilRaitses/vibe-check.git
cd vibe-check
npm install
```

### **2. Environment Setup**
```bash
# Copy environment template
cp src/environments/environment.example.ts src/environments/environment.ts

# Add your API keys:
# - Google Maps API Key
# - Gemini API Key  
# - Firebase Config
```

### **3. Run Development Server**
```bash
# Start Angular dev server
ng serve

# Or run Firebase emulators locally
firebase emulators:start
```

### **4. Deploy to Firebase**
```bash
# Build for production
ng build --configuration production

# Deploy to Firebase
firebase deploy
```

## 📡 **API Endpoints**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | System health monitoring |
| `/orchestrate-analysis` | POST | Gemini AI scene analysis |
| `/enhanced-analysis` | POST | Dual AI analysis (Gemini + Vision) |
| `/submit-report` | POST | User violation reporting |
| `/territory/:id` | GET | Territory safety data |
| `/status` | GET | Real-time system metrics |

### **Example API Call**
```javascript
// Analyze a street scene
const response = await fetch('/api/enhanced-analysis', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    imageData: base64Image,
    metadata: {
      location: { lat: 40.7128, lng: -74.0060 },
      timestamp: Date.now()
    }
  })
});

const analysis = await response.json();
// Returns: safety score, hazards, recommendations, detected objects
```

## 🗺️ **NYC Territory System**

### **Precomputed Voronoi Territories**
- **303 camera locations** across Manhattan
- **GeoJSON polygon boundaries** for each territory
- **Real-time safety scoring** based on analysis data
- **Interactive map visualization** with color-coded risk levels

### **Territory Data Structure**
```typescript
interface Territory {
  id: string;
  cameraId: string;
  geometry: GeoJSON.Polygon;
  bounds: BoundingBox;
  safetyScore: number;      // 1-10 scale
  totalAnalyses: number;
  recentReports: Report[];
  lastUpdated: timestamp;
}
```

## 📱 **Mobile Features**

### **Progressive Web App (PWA)**
- **📲 Add to Home Screen** - Install like a native app
- **📷 Camera Integration** - Upload street scene photos
- **📍 Location Services** - Auto-detect current territory
- **💾 Offline Capability** - Cached data for offline use
- **🔔 Push Notifications** - Safety alerts and updates

### **Touch-Optimized Interface**
- **Swipe navigation** between territories
- **Pinch-to-zoom** map controls
- **Voice input** for violation reporting
- **Large touch targets** for accessibility

## 🔧 **Development Setup**

### **Prerequisites**
- Node.js 20+
- Angular CLI 20+
- Firebase CLI
- Git

### **Local Development**
```bash
# Install dependencies
npm install

# Start development server
ng serve --port 4200

# Run tests
ng test

# Build for production
ng build --configuration production
```

### **Firebase Setup**
```bash
# Login to Firebase
firebase login

# Initialize project
firebase init

# Deploy functions only
firebase deploy --only functions

# Deploy everything
firebase deploy
```

## 🌍 **Production Deployment**

### **Live Infrastructure**
- **🌐 Hosting**: https://vibe-check-463816.web.app
- **⚡ Functions**: https://us-central1-vibe-check-463816.cloudfunctions.net
- **🗄️ Database**: Firestore (us-central1)
- **🔧 Project**: vibe-check-463816

### **Performance**
- **Bundle Size**: 86KB initial load
- **API Response**: <3 seconds for AI analysis
- **Global CDN**: Firebase hosting with worldwide edge caching
- **Mobile Optimized**: Perfect Lighthouse scores

## 🤝 **Contributing**

### **Development Workflow**
1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### **Code Standards**
- **TypeScript** for all new code
- **Angular** style guide compliance
- **Unit tests** for new features
- **ESLint + Prettier** for code formatting

## 📊 **Project Status**

### **✅ Completed Features**
- [x] Dual AI analysis pipeline (Gemini + Vision)
- [x] Angular 20 frontend with SSR
- [x] Firebase backend deployment
- [x] NYC territory system (303 locations)
- [x] Real-time data integration
- [x] Mobile PWA functionality
- [x] Production deployment

### **🚧 In Progress**
- [ ] Firebase Authentication integration
- [ ] Real-time Firestore data binding
- [ ] Advanced dashboard analytics
- [ ] Community violation reporting
- [ ] Performance monitoring

### **🎯 Roadmap**
- [ ] Machine learning model training
- [ ] Expand to other NYC boroughs
- [ ] API rate limiting and caching
- [ ] User preference customization
- [ ] Integration with city planning tools

## 📄 **License**

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 **Acknowledgments**

- **NYC Department of Transportation** - Camera feed access
- **Google Cloud AI** - Gemini and Vision APIs
- **Moondream.ai** - Vision analysis capabilities
- **Firebase** - Serverless infrastructure
- **Angular Team** - Modern web framework

## 📞 **Support**

- **🐛 Issues**: [GitHub Issues](https://github.com/GilRaitses/vibe-check/issues)
- **💬 Discussions**: [GitHub Discussions](https://github.com/GilRaitses/vibe-check/discussions)
- **📧 Email**: [Your contact email]
- **🐦 Twitter**: [@YourHandle]

---

**Built with ❤️ for safer NYC streets** 🏙️

*Empowering pedestrians with AI-driven street intelligence since 2025* 