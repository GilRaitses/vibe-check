# 🚴‍♀️ NYC Traffic Safety App - Hackathon Team Setup

**Repository**: https://github.com/manngup/nice-people-hackathon

A React Native app that analyzes NYC traffic cameras using AI to detect bicycles and assess cycling safety risks.

## 👥 Team Members & Personal Branches

Each team member has their own branch to work on:

- **Effy** → `effy-version` branch
- **Rainer** → `rainer-version` branch  
- **Gil** → `gil-version` branch
- **Main** → `main` branch (shared/final version)

## 🚀 Quick Setup for Team Members

### For Effy 🚴‍♀️

**Step 1: Use this Cursor prompt**
```
I'm part of a hackathon team working on a NYC Traffic Safety App. Please help me set up my personal branch of the project in Cursor.

Repository: https://github.com/manngup/nice-people-hackathon
My branch: effy-version

Please:
1. Clone the repository 
2. Switch to my personal branch (effy-version)
3. Navigate to the test-safety-app directory
4. Install dependencies with npm install
5. Show me the project structure and explain what the app does
6. Set up git so I can push my changes back to GitHub

This is a React Native app that analyzes NYC traffic cameras using AI to detect bicycles. I want to understand the codebase and start customizing it for my hackathon contribution.
```

**Step 2: Manual setup (if needed)**
```bash
# Clone the repository
git clone https://github.com/manngup/nice-people-hackathon.git
cd nice-people-hackathon

# Switch to your branch
git checkout effy-version

# Navigate to your app
cd test-safety-app

# Install dependencies
npm install

# Start developing!
npx expo start
```

**Step 3: Push your changes**
```bash
# Add your changes
git add .

# Commit with a message
git commit -m "Effy: [describe your changes]"

# Push to GitHub
git push origin effy-version
```

---

### For Rainer 🚴‍♂️

**Step 1: Use this Cursor prompt**
```
I'm part of a hackathon team working on a NYC Traffic Safety App. Please help me set up my personal branch of the project in Cursor.

Repository: https://github.com/manngup/nice-people-hackathon
My branch: rainer-version

Please:
1. Clone the repository 
2. Switch to my personal branch (rainer-version)
3. Navigate to the test-safety-app directory
4. Install dependencies with npm install
5. Show me the project structure and explain what the app does
6. Set up git so I can push my changes back to GitHub

This is a React Native app that analyzes NYC traffic cameras using AI to detect bicycles. I want to understand the codebase and start customizing it for my hackathon contribution.
```

**Step 2: Manual setup (if needed)**
```bash
# Clone the repository
git clone https://github.com/manngup/nice-people-hackathon.git
cd nice-people-hackathon

# Switch to your branch
git checkout rainer-version

# Navigate to your app
cd test-safety-app

# Install dependencies
npm install

# Start developing!
npx expo start
```

**Step 3: Push your changes**
```bash
# Add your changes
git add .

# Commit with a message
git commit -m "Rainer: [describe your changes]"

# Push to GitHub
git push origin rainer-version
```

---

### For Gil 🚴‍♂️

**Step 1: Use this Cursor prompt**
```
I'm part of a hackathon team working on a NYC Traffic Safety App. Please help me set up my personal branch of the project in Cursor.

Repository: https://github.com/manngup/nice-people-hackathon
My branch: gil-version

Please:
1. Clone the repository 
2. Switch to my personal branch (gil-version)
3. Navigate to the test-safety-app directory
4. Install dependencies with npm install
5. Show me the project structure and explain what the app does
6. Set up git so I can push my changes back to GitHub

This is a React Native app that analyzes NYC traffic cameras using AI to detect bicycles. I want to understand the codebase and start customizing it for my hackathon contribution.
```

**Step 2: Manual setup (if needed)**
```bash
# Clone the repository
git clone https://github.com/manngup/nice-people-hackathon.git
cd nice-people-hackathon

# Switch to your branch
git checkout gil-version

# Navigate to your app
cd test-safety-app

# Install dependencies
npm install

# Start developing!
npx expo start
```

**Step 3: Push your changes**
```bash
# Add your changes
git add .

# Commit with a message
git commit -m "Gil: [describe your changes]"

# Push to GitHub
git push origin gil-version
```

---

## 🔄 Exploring Other Team Members' Work

Once you have the repo cloned, you can easily check out what others are working on:

```bash
# See all branches
git branch -a

# Check out Effy's work
git checkout effy-version
cd test-safety-app
npx expo start

# Check out Rainer's work
git checkout rainer-version
cd test-safety-app
npx expo start

# Check out Gil's work
git checkout gil-version
cd test-safety-app
npx expo start

# Go back to your branch
git checkout [your-branch-name]
```

## 📱 App Features

- **Real NYC Traffic Cameras**: Loads 938+ live camera feeds from NYC TMC
- **AI Bicycle Detection**: Uses Moondream AI to detect cyclists in camera feeds
- **Interactive Heat Map**: Visual safety assessment based on bicycle activity
- **Rate-Limited Analysis**: Prevents API overload with smart request queuing
- **On-Demand Analysis**: Tap camera markers to analyze specific locations

## 🔧 Technical Stack

- **React Native** with Expo
- **NYC TMC API** for real traffic camera data
- **Moondream AI** for computer vision analysis
- **React Native Maps** for interactive mapping
- **Rate limiting** to prevent API abuse

## 🎯 Hackathon Goals

- Demonstrate real-world API integration
- Show AI-powered computer vision in mobile apps
- Create practical safety tool for NYC cyclists
- Learn React Native and mobile development
- Collaborate effectively using Git branches

## 🆘 Need Help?

1. **Check your branch's README** - Each branch has detailed instructions
2. **Ask team members** - We're all learning together!
3. **Review the code** - Lots of helpful comments throughout
4. **Use Cursor's AI** - Great for explaining React Native concepts

## 📋 Prerequisites

- Node.js (v16 or later)
- npm or yarn
- Expo CLI: `npm install -g @expo/cli`
- Expo Go app on your mobile device
- Git configured with your GitHub account

Happy coding, team! 🚀 