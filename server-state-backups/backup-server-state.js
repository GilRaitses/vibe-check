#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const http = require('http');

const BACKUP_DIR = __dirname;
const SERVER_URL = 'http://10.4.32.157:3001';
const APP_DIR = path.join(__dirname, '..', 'test-safety-app');

// Create timestamp for backup
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = path.join(BACKUP_DIR, 'daily-snapshots', timestamp);

console.log('🔄 [BACKUP] Starting server state backup...');
console.log(`📁 [BACKUP] Backup location: ${backupPath}`);

async function createBackup() {
  try {
    // Create backup directory
    fs.mkdirSync(backupPath, { recursive: true });
    
    // 1. Backup territory server state
    await backupTerritoryServer();
    
    // 2. Backup mobile app configurations
    await backupConfigurations();
    
    // 3. Create backup manifest
    await createManifest();
    
    // 4. Update latest symlink
    updateLatestLink();
    
    console.log('✅ [BACKUP] Server state backup completed successfully!');
    console.log(`📦 [BACKUP] Backup saved to: ${backupPath}`);
    
  } catch (error) {
    console.error('❌ [BACKUP] Backup failed:', error);
    process.exit(1);
  }
}

async function backupTerritoryServer() {
  console.log('🌐 [BACKUP] Backing up territory server state...');
  
  const serverDir = path.join(backupPath, 'territory-server');
  fs.mkdirSync(serverDir, { recursive: true });
  
  try {
    // Test server status
    const statusResponse = await fetch(`${SERVER_URL}/status`);
    const serverStatus = await statusResponse.json();
    
    fs.writeFileSync(
      path.join(serverDir, 'server-status.json'),
      JSON.stringify(serverStatus, null, 2)
    );
    
    console.log('✅ [BACKUP] Server status captured');
    
    // Backup territories data (what the server is serving)
    const territoriesResponse = await fetch(`${SERVER_URL}/territories`);
    const territoriesData = await territoriesResponse.json();
    
    fs.writeFileSync(
      path.join(serverDir, 'territories-served.json'),
      JSON.stringify(territoriesData, null, 2)
    );
    
    const dataSize = (JSON.stringify(territoriesData).length / 1024 / 1024).toFixed(2);
    console.log(`✅ [BACKUP] Territories data captured (${dataSize} MB)`);
    
  } catch (error) {
    console.warn('⚠️ [BACKUP] Could not connect to territory server:', error.message);
    
    // Fallback: backup the source file
    const sourceFile = path.join(APP_DIR, 'assets', 'precomputed-territories.json');
    if (fs.existsSync(sourceFile)) {
      fs.copyFileSync(sourceFile, path.join(serverDir, 'territories-source.json'));
      console.log('✅ [BACKUP] Source territories file backed up');
    }
  }
  
  // Server configuration
  const serverConfig = {
    url: SERVER_URL,
    timestamp: new Date().toISOString(),
    port: 3001,
    endpoints: ['/territories', '/status'],
    cors_enabled: true
  };
  
  fs.writeFileSync(
    path.join(serverDir, 'server-config.json'),
    JSON.stringify(serverConfig, null, 2)
  );
}

async function backupConfigurations() {
  console.log('⚙️ [BACKUP] Backing up app configurations...');
  
  const configDir = path.join(backupPath, 'configurations');
  fs.mkdirSync(configDir, { recursive: true });
  
  // Vision configuration (25-variable)
  const visionConfigPath = path.join(APP_DIR, 'config', 'visionConfig.ts');
  if (fs.existsSync(visionConfigPath)) {
    fs.copyFileSync(visionConfigPath, path.join(configDir, 'visionConfig.ts'));
    console.log('✅ [BACKUP] Vision config backed up');
  }
  
  // Sidewalk violation configuration (13-variable)
  const violationConfigPath = path.join(APP_DIR, 'config', 'sidewalkViolationConfig.ts');
  if (fs.existsSync(violationConfigPath)) {
    fs.copyFileSync(violationConfigPath, path.join(configDir, 'sidewalkViolationConfig.ts'));
    console.log('✅ [BACKUP] Violation config backed up');
  }
  
  // Voronoi loader configuration
  const voronoiLoaderPath = path.join(APP_DIR, 'services', 'voronoiLoader.ts');
  if (fs.existsSync(voronoiLoaderPath)) {
    fs.copyFileSync(voronoiLoaderPath, path.join(configDir, 'voronoiLoader.ts'));
    console.log('✅ [BACKUP] Voronoi loader config backed up');
  }
  
  // Environment configuration
  const envPath = path.join(APP_DIR, '.env');
  if (fs.existsSync(envPath)) {
    // Read and sanitize .env file (remove sensitive data)
    const envContent = fs.readFileSync(envPath, 'utf8');
    const sanitizedEnv = envContent
      .split('\n')
      .map(line => {
        if (line.includes('API_KEY') || line.includes('TOKEN')) {
          const [key] = line.split('=');
          return `${key}=***REDACTED***`;
        }
        return line;
      })
      .join('\n');
    
    fs.writeFileSync(path.join(configDir, 'env-sanitized.txt'), sanitizedEnv);
    console.log('✅ [BACKUP] Environment config backed up (sanitized)');
  }
}

async function createManifest() {
  console.log('📋 [BACKUP] Creating backup manifest...');
  
  const manifest = {
    timestamp: new Date().toISOString(),
    backup_type: 'server-state',
    version: '1.0.0',
    components: {
      territory_server: {
        status: 'captured',
        data_size_mb: 'calculated',
        endpoints_tested: ['/territories', '/status']
      },
      configurations: {
        vision_config: fs.existsSync(path.join(backupPath, 'configurations', 'visionConfig.ts')),
        violation_config: fs.existsSync(path.join(backupPath, 'configurations', 'sidewalkViolationConfig.ts')),
        voronoi_loader: fs.existsSync(path.join(backupPath, 'configurations', 'voronoiLoader.ts')),
        environment: fs.existsSync(path.join(backupPath, 'configurations', 'env-sanitized.txt'))
      }
    },
    backup_location: backupPath,
    restore_instructions: 'Use restore-from-backup.js to restore this backup'
  };
  
  fs.writeFileSync(
    path.join(backupPath, 'backup-manifest.json'),
    JSON.stringify(manifest, null, 2)
  );
  
  console.log('✅ [BACKUP] Manifest created');
}

function updateLatestLink() {
  const latestLink = path.join(BACKUP_DIR, 'daily-snapshots', 'latest');
  
  // Remove existing symlink
  if (fs.existsSync(latestLink)) {
    fs.unlinkSync(latestLink);
  }
  
  // Create new symlink
  fs.symlinkSync(timestamp, latestLink);
  console.log('🔗 [BACKUP] Latest symlink updated');
}

// Run backup
createBackup(); 