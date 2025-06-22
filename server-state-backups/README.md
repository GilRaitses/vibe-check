# Server State Backups

This directory contains automated backups of the NYC Safety App server state and session data.

## What Gets Backed Up

### 1. Territory Server State
- **Active territories**: Currently loaded territory data
- **Server configuration**: IP address, port, endpoints
- **Access logs**: Mobile app connection history
- **Performance metrics**: Data transfer sizes, response times

### 2. Session Cache Data
- **Mobile session snapshots**: What data is cached on devices
- **Analysis results**: Stored camera analysis results
- **User location data**: Proximity calculations and territory loading
- **AsyncStorage dumps**: Complete mobile app storage state

### 3. Configuration Snapshots
- **Vision config**: 25-variable analysis configuration
- **Sidewalk violation config**: 13-variable violation detection
- **API settings**: Moondream authentication and endpoints
- **Network settings**: Server IP, CORS configuration

## Backup Schedule

- **Real-time**: Server access logs and performance metrics
- **Every app session**: Mobile cache state when app starts/stops
- **Daily**: Complete configuration and territory data snapshots
- **On changes**: Whenever configurations or server settings change

## Directory Structure

```
server-state-backups/
├── territory-server/
│   ├── access-logs/          # HTTP request logs
│   ├── performance/          # Response times, data sizes
│   └── config-snapshots/     # Server configuration history
├── mobile-sessions/
│   ├── cache-dumps/          # AsyncStorage state snapshots
│   ├── analysis-results/     # Stored camera analysis data
│   └── user-activity/        # Location and interaction logs
├── configurations/
│   ├── vision-configs/       # 25-variable config versions
│   ├── violation-configs/    # 13-variable config versions
│   └── network-configs/      # IP addresses and network settings
└── daily-snapshots/
    ├── YYYY-MM-DD/          # Complete daily backups
    └── latest/              # Symlink to most recent backup
```

## Automated Backup Scripts

- `backup-server-state.js` - Creates complete server state backup
- `dump-mobile-cache.js` - Exports AsyncStorage data from mobile sessions
- `monitor-territory-server.js` - Real-time logging of server activity
- `restore-from-backup.js` - Restore server state from backup

## Data Privacy

All backups are stored locally on your computer only. No data is transmitted to external servers or cloud services. User location data is anonymized and aggregated for analysis purposes only. 