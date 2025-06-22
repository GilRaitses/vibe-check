# NYC Safety App - Territory Server Setup

The NYC Safety App now loads camera territories from your computer instead of storing them on your phone. This keeps the data on your computer while allowing the mobile app to access it over your local network.

## Quick Start

1. **Start the Territory Server**
   ```bash
   cd test-safety-app
   node scripts/territory-server.js
   ```

2. **Update IP Address (if needed)**
   - The server will show your computer's IP address when it starts
   - If the IP in `services/voronoiLoader.ts` doesn't match, update line 6:
   ```typescript
   const LOCAL_SERVER_URL = 'http://YOUR_IP_ADDRESS:3001';
   ```

3. **Start Your Mobile App**
   ```bash
   npx expo start
   ```

## How It Works

### Territory Server (`scripts/territory-server.js`)
- Serves the `assets/precomputed-territories.json` file over HTTP
- Runs on port 3001
- Automatically detects your computer's IP address
- Provides CORS headers for mobile app access

### Mobile App Loading (`services/voronoiLoader.ts`)
- Fetches territories from your computer when the app starts
- Temporarily caches data in phone's session storage
- Falls back to cached data if server is unavailable
- No permanent storage on phone

### Endpoints Available

- `GET /territories` - Returns the full territories JSON data
- `GET /status` - Server health check

## Network Requirements

- Your computer and phone must be on the same WiFi network
- Port 3001 must be accessible (usually automatic on home networks)
- Firewall should allow connections on port 3001

## Troubleshooting

### "Failed to load territories from computer"
1. Check that the territory server is running
2. Verify your computer and phone are on the same WiFi
3. Make sure the IP address in `voronoiLoader.ts` is correct
4. Test the server with: `curl http://YOUR_IP:3001/status`

### "Territories file not found"
- Make sure `assets/precomputed-territories.json` exists
- The file should be about 465KB with 303 camera territories

### Server won't start
- Check if port 3001 is already in use: `lsof -i :3001`
- Kill existing process: `kill -9 PID`
- Try a different port by editing the `PORT` variable

## Data Flow

```
Computer (Territory Server)
├── assets/precomputed-territories.json (465KB)
├── scripts/territory-server.js (HTTP server)
└── Port 3001

        ↓ HTTP Request over WiFi

Mobile App
├── services/voronoiLoader.ts (fetches data)
├── AsyncStorage (session cache only)
└── App uses territories for analysis
```

## Benefits

✅ **Data stays on computer** - No permanent storage on phone  
✅ **Always up-to-date** - Territories loaded fresh each session  
✅ **Easy updates** - Just replace the JSON file on computer  
✅ **Network efficient** - Only loads when app starts  
✅ **Fallback support** - Uses cached data if server unavailable  

## Files Modified

- `services/voronoiLoader.ts` - Now fetches from HTTP instead of local file
- `services/proximityService.ts` - Updated to use session cache key
- `scripts/territory-server.js` - New HTTP server for territories
- `scripts/start-territory-server.js` - Helper script with IP detection

The old `assets/precomputed-territories.json` file is still there and used by the server, but it's no longer bundled into the mobile app. 