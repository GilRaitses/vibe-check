# 🚀 Firebase Deployment Guide for Vibe-Check

Your Firebase project is now configured! Here's everything you need to deploy.

## ✅ What's Already Set Up

- **Firebase Project**: `vibe-check-463816`
- **Configuration Files**: `firebase.json`, `.firebaserc`
- **Cloud Functions**: Complete API with Gemini AI integration
- **Firestore**: Database rules and structure
- **Hosting**: Angular build configuration

## 🔧 Environment Variables Setup

Create a `.env` file in your `functions/` directory:

```bash
cd functions
echo "GOOGLE_GEMINI_API_KEY=your_gemini_api_key_here" > .env
```

**Required API Keys:**
- `GOOGLE_GEMINI_API_KEY` - Get from [Google AI Studio](https://makersuite.google.com/app/apikey)
- `MOONDREAM_API_KEY` - From your existing test-safety-app configuration

## 🏗️ Build and Deploy Steps

### 1. Build the Angular Frontend
```bash
ng build --configuration production
```

### 2. Deploy Cloud Functions
```bash
cd functions
npm run deploy
```

### 3. Deploy Hosting
```bash
firebase deploy --only hosting
```

### 4. Deploy Everything at Once
```bash
firebase deploy
```

## 🔥 Firebase Console Links

- **Project Console**: https://console.firebase.google.com/project/vibe-check-463816/overview
- **Functions**: https://console.firebase.google.com/project/vibe-check-463816/functions
- **Firestore**: https://console.firebase.google.com/project/vibe-check-463816/firestore
- **Hosting**: https://console.firebase.google.com/project/vibe-check-463816/hosting

## 🌐 API Endpoints (After Deployment)

Your Cloud Functions will be available at:
- `https://us-central1-vibe-check-463816.cloudfunctions.net/api/health`
- `https://us-central1-vibe-check-463816.cloudfunctions.net/api/orchestrate-analysis`
- `https://us-central1-vibe-check-463816.cloudfunctions.net/api/submit-report`
- `https://us-central1-vibe-check-463816.cloudfunctions.net/api/territory/{territoryId}`
- `https://us-central1-vibe-check-463816.cloudfunctions.net/api/status`

## 🧪 Testing Locally

### Start Firebase Emulators
```bash
firebase emulators:start
```

### Test Endpoints Locally
```bash
curl http://localhost:5001/vibe-check-463816/us-central1/api/health
```

## 📊 Monitoring & Metrics

- **Cloud Functions Logs**: `firebase functions:log`
- **Firestore Activity**: Check Firebase Console
- **Daily Reports**: Auto-generated at 9 AM EST
- **System Status**: Available via `/status` endpoint

## 🎯 Wednesday Presentation Checklist

- [ ] Deploy functions: `firebase deploy --only functions`
- [ ] Deploy hosting: `firebase deploy --only hosting`  
- [ ] Test API endpoints
- [ ] Verify Gemini AI integration
- [ ] Check daily report generation
- [ ] Ensure real-time dashboard works

## 🔒 Security Notes

- Firestore rules require authentication
- Environment variables stored securely in Firebase
- Rate limiting built into Cloud Functions
- CORS enabled for web access

## 📱 Integration with Existing App

Your `test-safety-app` can now connect to these APIs:

```typescript
const API_BASE = 'https://us-central1-vibe-check-463816.cloudfunctions.net/api';

// Analyze image
const analysis = await fetch(`${API_BASE}/orchestrate-analysis`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ imageData, metadata })
});

// Submit user report
const report = await fetch(`${API_BASE}/submit-report`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ location, reportType, description })
});
```

## 🎉 Ready for Wednesday!

Your Firebase infrastructure is production-ready and should handle the Google Cloud AI team presentation smoothly.

**Need help?** Check the Firebase Console logs or run `firebase --help` for more commands. 