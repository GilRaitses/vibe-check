# Firebase Setup Prompt for Vibe-Check Project

Hi! I need help setting up Firebase infrastructure for my **vibe-check** project. Here's the complete context:

## Repository Context
**GitHub Repository**: https://github.com/GilRaitses/vibe-check

This is an AI-orchestrated urban navigation intelligence system that helps NYC pedestrians choose less stressful routes. I'm presenting this to the Google Cloud AI team on Wednesday, so I need Firebase integration ASAP.

## Project Background & Logs
**READ THESE LOGS FIRST** to understand the technical journey:
- `log/2025-06-21.md` - Original hackathon development
- `log/2025-06-22.md` - Performance optimization breakthroughs  
- `log/2025-06-23.md` - Today's Firebase migration decision + Gemini orchestration architecture

**Key Context**: We migrated from a failing server-state architecture to Firebase because we need:
- Gemini AI agent orchestrating all services
- Real-time state sequencing of urban conditions
- Scalable deployment for community use
- Google Cloud AI integration for Wednesday's presentation

## YOUR MISSION: Firebase Infrastructure Setup

### 1. **PERMISSION TO MODIFY**
- **You can ERASE anything in the Angular `src/` folder** - rebuild it properly for Firebase
- **Keep `gemini-orchestrator/` folder** - this is the core AI architecture
- **Keep `test-safety-app/services/`** - reference these for migration
- **Keep `shared/types/`** - these are the new type definitions
- **Keep `log/` and `presentation/`** - needed for context

### 2. **Environment Variables Setup**
I need help configuring these API keys:

```bash
# Required Environment Variables
GOOGLE_GEMINI_API_KEY=         # For AI orchestration
MOONDREAM_API_KEY=             # For vision analysis (existing service)
FIREBASE_PROJECT_ID=           # Your generated project ID
FIREBASE_PRIVATE_KEY=          # Service account key
FIREBASE_CLIENT_EMAIL=         # Service account email
```

**Where to find Moondream setup**: Check `test-safety-app/services/moondreamService.ts` for existing API integration patterns.

### 3. **Key Services to Implement**
- Deploy existing vision analysis as Cloud Functions
- Migrate user violation reporting system
- Implement AI-driven configuration management
- Create real-time dashboard for orchestrator status

### 4. **Deployment Goals**
By Wednesday I need:
- **Live Firebase Hosting** deployment
- **Working Gemini orchestration** Cloud Functions
- **Real-time dashboard** showing AI agent status
- **Demo-ready** violation reporting system
- **Community clone-and-deploy** capability

Please start by examining the logs and existing services, then guide me through the Firebase setup process step by step!
