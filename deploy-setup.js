const fs = require('fs');

console.log('🚀 VIBE-CHECK: CLOUD DEPLOYMENT & DEMO SETUP');
console.log('=============================================');

async function setupCloudDeployment() {
  console.log('🎯 Setting up cloud deployment for your talk...');
  
  // Create Firebase hosting configuration
  const firebaseJson = {
    "hosting": {
      "public": "public",
      "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
      "rewrites": [
        {"source": "/api/**", "function": "api"},
        {"source": "**", "destination": "/index.html"}
      ]
    },
    "functions": {
      "source": "functions",
      "predeploy": ["npm --prefix \"$RESOURCE_DIR\" run build"]
    }
  };
  
  fs.writeFileSync('firebase.json', JSON.stringify(firebaseJson, null, 2));
  console.log('✅ Updated firebase.json for cloud hosting');
  
  console.log('\n🌐 DEPLOYMENT COMMANDS:');
  console.log('firebase deploy --only functions');
  console.log('firebase deploy --only hosting');
}

setupCloudDeployment(); 