const fs = require('fs');
const https = require('https');

// Load camera zones
const cameras = JSON.parse(fs.readFileSync('data/voronoi-tessellation-coastline.json', 'utf8'));

console.log(`🎯 Vision Analysis Scheduler starting with ${cameras.length} land-based cameras...`);

// Analysis schedule configuration
const ANALYSIS_SCHEDULE = {
  RUSH_HOUR_MORNING: { start: 8, end: 10, maxSamples: 1000 },
  LUNCH_HOUR: { start: 12, end: 14, maxSamples: 1000 },
  RUSH_HOUR_EVENING: { start: 16, end: 18, maxSamples: 1000 }
};

// Sample frequencies and scoring
const FREQUENCY_SCORES = {
  bike_violations: { weight: 0.4, target_daily: 0 }, // Zero tolerance
  pedestrian_conflicts: { weight: 0.3, target_daily: 5 },
  traffic_density: { weight: 0.2, target_daily: 50 },
  infrastructure_issues: { weight: 0.1, target_daily: 2 }
};

let analysisStats = {
  daily_samples: 0,
  hourly_samples: 0,
  current_hour: new Date().getHours(),
  total_violations_detected: 0,
  camera_scores: new Map(),
  last_reset: Date.now()
};

// In-memory storage for analysis results
let visionAnalysisResults = [];

function getCurrentAnalysisWindow() {
  const hour = new Date().getHours();
  
  for (const [window, config] of Object.entries(ANALYSIS_SCHEDULE)) {
    if (hour >= config.start && hour < config.end) {
      return { window, config };
    }
  }
  
  return null; // Outside analysis windows
}

function shouldAnalyzeNow() {
  const currentWindow = getCurrentAnalysisWindow();
  if (!currentWindow) return false;
  
  const hour = new Date().getHours();
  if (hour !== analysisStats.current_hour) {
    // Reset hourly counter
    analysisStats.hourly_samples = 0;
    analysisStats.current_hour = hour;
    console.log(`📅 New hour ${hour}:00 - Reset hourly sample count`);
  }
  
  return analysisStats.hourly_samples < currentWindow.config.maxSamples;
}

function selectCameraForAnalysis() {
  // Day 1: Random sampling for baseline
  // After Day 1: Score-based or user-interaction sampling
  const isDay1 = (Date.now() - analysisStats.last_reset) < (24 * 60 * 60 * 1000);
  
  if (isDay1) {
    // Random selection for baseline
    const randomIndex = Math.floor(Math.random() * cameras.length);
    return cameras[randomIndex];
  } else {
    // Score-based selection (prioritize cameras with higher violation scores)
    const sortedCameras = cameras.sort((a, b) => {
      const scoreA = analysisStats.camera_scores.get(a.handle) || 0;
      const scoreB = analysisStats.camera_scores.get(b.handle) || 0;
      return scoreB - scoreA;
    });
    
    // 70% high-score cameras, 30% random for diversity
    const isHighScore = Math.random() < 0.7;
    if (isHighScore && sortedCameras.length > 10) {
      const topIndex = Math.floor(Math.random() * Math.min(10, sortedCameras.length));
      return sortedCameras[topIndex];
    } else {
      const randomIndex = Math.floor(Math.random() * cameras.length);
      return cameras[randomIndex];
    }
  }
}

async function fetchCameraImage(cameraId) {
  return new Promise((resolve, reject) => {
    const url = `https://webcams.nyctmc.org/api/cameras/${cameraId}/image`;
    
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NYC-Vision-Analysis/1.0)'
      }
    }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const imageBuffer = Buffer.concat(chunks);
        resolve(imageBuffer);
      });
    }).on('error', reject);
  });
}

function analyzeImageForViolations(imageBuffer, camera) {
  // Mock vision analysis - in production would use Google Vision API or similar
  const mockAnalysis = {
    bike_violations: Math.random() > 0.85 ? Math.floor(Math.random() * 3) + 1 : 0,
    pedestrian_conflicts: Math.random() > 0.7 ? Math.floor(Math.random() * 2) + 1 : 0,
    traffic_density: Math.floor(Math.random() * 10) + 1,
    infrastructure_issues: Math.random() > 0.9 ? 1 : 0,
    confidence_score: 0.75 + Math.random() * 0.25,
    analysis_timestamp: Date.now(),
    image_size: imageBuffer.length
  };
  
  // Calculate frequency score
  let frequencyScore = 0;
  for (const [violation, data] of Object.entries(FREQUENCY_SCORES)) {
    const detected = mockAnalysis[violation] || 0;
    const weight = data.weight;
    const normalized = Math.min(detected / (data.target_daily || 1), 2); // Cap at 2x target
    frequencyScore += normalized * weight;
  }
  
  mockAnalysis.frequency_score = frequencyScore;
  
  return mockAnalysis;
}

function updateCameraScore(camera, analysisResult) {
  const currentScore = analysisStats.camera_scores.get(camera.handle) || 0;
  const newScore = analysisResult.frequency_score;
  
  // Weighted average: 70% historical, 30% new
  const updatedScore = (currentScore * 0.7) + (newScore * 0.3);
  analysisStats.camera_scores.set(camera.handle, updatedScore);
  
  return updatedScore;
}

async function performVisionAnalysis() {
  if (!shouldAnalyzeNow()) {
    return null;
  }
  
  const camera = selectCameraForAnalysis();
  const cameraId = camera.image_url?.match(/cameras\/([^\/]+)\/image/)?.[1];
  
  if (!cameraId) {
    console.warn(`No valid camera ID for ${camera.handle}`);
    return null;
  }
  
  try {
    console.log(`🔍 Analyzing camera ${camera.handle} (${analysisStats.hourly_samples + 1}/1000 this hour)`);
    
    const imageBuffer = await fetchCameraImage(cameraId);
    const analysisResult = analyzeImageForViolations(imageBuffer, camera);
    const updatedScore = updateCameraScore(camera, analysisResult);
    
    // Store analysis result
    const result = {
      camera_handle: camera.handle,
      camera_name: camera.name,
      coordinates: camera.coordinates,
      analysis: analysisResult,
      updated_score: updatedScore,
      analysis_window: getCurrentAnalysisWindow()?.window,
      sample_number: analysisStats.hourly_samples + 1
    };
    
    visionAnalysisResults.push(result);
    
    // Update stats
    analysisStats.hourly_samples++;
    analysisStats.daily_samples++;
    analysisStats.total_violations_detected += (
      analysisResult.bike_violations + 
      analysisResult.pedestrian_conflicts + 
      analysisResult.infrastructure_issues
    );
    
    // Log significant findings
    if (analysisResult.bike_violations > 0) {
      console.log(`🚨 BIKE VIOLATION: ${camera.handle} detected ${analysisResult.bike_violations} violations (score: ${updatedScore.toFixed(2)})`);
    }
    
    if (analysisResult.frequency_score > 1.0) {
      console.log(`⚠️  HIGH ACTIVITY: ${camera.handle} frequency score ${analysisResult.frequency_score.toFixed(2)}`);
    }
    
    return result;
    
  } catch (error) {
    console.error(`❌ Analysis failed for ${camera.handle}:`, error.message);
    return null;
  }
}

// Analysis loop
function startAnalysisLoop() {
  console.log(`🚀 Starting vision analysis scheduler...`);
  console.log(`📅 Analysis windows: Morning 8-10am, Lunch 12-2pm, Evening 4-6pm`);
  console.log(`📊 Max 1000 samples per hour during analysis windows`);
  
  setInterval(async () => {
    const currentWindow = getCurrentAnalysisWindow();
    
    if (currentWindow) {
      const result = await performVisionAnalysis();
      
      // Save results every 10 samples
      if (analysisStats.hourly_samples % 10 === 0) {
        saveAnalysisResults();
      }
    }
    
  }, 3600); // Analyze every ~3.6 seconds to reach 1000/hour max
}

function saveAnalysisResults() {
  const summary = {
    analysis_stats: analysisStats,
    top_cameras_by_score: Array.from(analysisStats.camera_scores.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 20)
      .map(([handle, score]) => ({ handle, score: score.toFixed(3) })),
    recent_results: visionAnalysisResults.slice(-50), // Last 50 analyses
    generated_at: new Date().toISOString()
  };
  
  fs.writeFileSync('data/vision-analysis-results.json', JSON.stringify(summary, null, 2));
  console.log(`📊 Saved analysis results: ${analysisStats.daily_samples} samples today, ${analysisStats.total_violations_detected} violations detected`);
}

// API endpoints for integration
function getAnalysisAPI() {
  return {
    getCurrentStats: () => ({
      ...analysisStats,
      camera_scores: Object.fromEntries(analysisStats.camera_scores),
      current_window: getCurrentAnalysisWindow(),
      is_analyzing: shouldAnalyzeNow()
    }),
    
    getCameraScore: (handle) => analysisStats.camera_scores.get(handle) || 0,
    
    forceAnalysis: async (cameraHandle) => {
      const camera = cameras.find(c => c.handle === cameraHandle);
      if (!camera) return null;
      
      // Bypass hourly limits for user-requested analysis
      const originalCount = analysisStats.hourly_samples;
      analysisStats.hourly_samples = 0; // Temporarily reset
      
      const result = await performVisionAnalysis();
      
      analysisStats.hourly_samples = originalCount; // Restore
      
      console.log(`👆 User-requested analysis for ${cameraHandle}`);
      return result;
    },
    
    getTopViolationCameras: (limit = 10) => {
      return Array.from(analysisStats.camera_scores.entries())
        .sort(([,a], [,b]) => b - a)
        .slice(0, limit)
        .map(([handle, score]) => {
          const camera = cameras.find(c => c.handle === handle);
          return {
            handle,
            name: camera?.name || 'Unknown',
            score: score.toFixed(3),
            coordinates: camera?.coordinates
          };
        });
    }
  };
}

// Export for use in other modules
if (require.main === module) {
  startAnalysisLoop();
  
  // Save results every 5 minutes
  setInterval(saveAnalysisResults, 5 * 60 * 1000);
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down vision analysis scheduler...');
    saveAnalysisResults();
    process.exit(0);
  });
} else {
  module.exports = { getAnalysisAPI, performVisionAnalysis, saveAnalysisResults };
} 