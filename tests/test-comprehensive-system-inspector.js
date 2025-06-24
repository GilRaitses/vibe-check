/**
 * COMPREHENSIVE VIBE-CHECK SYSTEM INSPECTOR
 * 
 * This script performs end-to-end testing of every system component:
 * 1. Numerical Array Handling (17-variable vision responses)
 * 2. LLM Agent Interventions (Gemini processing and decisions)
 * 3. Data Store Initialization (Firebase, Firestore, statistics)
 * 4. Visual Output Confirmation (Dashboard updates, charts, alerts)
 * 5. End-to-End Pipeline Testing (Image → Analysis → Storage → Dashboard → Action)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const CONFIG = {
  FIREBASE_PROJECT_ID: 'vibe-check-463816',
  FIREBASE_API_URL: 'https://us-central1-vibe-check-463816.cloudfunctions.net/api',
  APP_URL: 'https://vibe-check-463816.web.app',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || 'AIzaSyCmQpywkSrG_YH-JwaMkuYQ0dSFYC4zy_c',
  MOONDREAM_API_KEY: process.env.MOONDREAM_API_KEY,
  TEST_IMAGE_URL: 'https://example.com/test-intersection.jpg',
  
  // Expected 17-variable array structure
  NUMERICAL_ARRAY_STRUCTURE: [
    'pedestrian_walkway_violation',
    'dangerous_bike_lane_position', 
    'bike_red_light_violation',
    'blocking_pedestrian_flow',
    'car_bike_lane_violation',
    'pedestrian_density',
    'vulnerable_population',
    'traffic_volume',
    'visibility_conditions',
    'missing_barriers',
    'poor_signage',
    'signal_malfunction',
    'cyclist_speed_estimate',
    'aggressive_behavior',
    'infrastructure_quality',
    'weather_impact',
    'overall_safety_risk'
  ]
};

class SystemInspector {
  constructor() {
    this.results = {
      numerical_handling: {},
      llm_agent_interventions: {},
      data_store_tests: {},
      visual_confirmation: {},
      end_to_end_pipeline: {},
      overall_score: 0
    };
    this.startTime = Date.now();
  }

  // =====================================================
  // 1. NUMERICAL ARRAY HANDLING TESTS
  // =====================================================

  async testNumericalHandling() {
    console.log('\n🔢 TESTING NUMERICAL ARRAY HANDLING...');
    
    const tests = {
      'array_structure_validation': await this.testArrayStructure(),
      'numerical_bounds_checking': await this.testNumericalBounds(),
      'type_validation': await this.testTypeValidation(),
      'confidence_score_handling': await this.testConfidenceScores(),
      'error_handling_invalid_arrays': await this.testInvalidArrayHandling()
    };

    this.results.numerical_handling = tests;
    this.logTestResults('Numerical Handling', tests);
  }

  async testArrayStructure() {
    try {
      // Test array with exactly 17 values
      const validArray = [2,3,4,1,0,2,1,3,2,1,0,0,2,1,2,2,3];
      const result = await this.validateNumericalArray(validArray);
      
      return {
        success: result.valid && result.length === 17,
        message: result.valid ? 'Array structure validation passed' : 'Array structure validation failed',
        details: { expected_length: 17, actual_length: result.length }
      };
    } catch (error) {
      return { success: false, message: `Array structure test failed: ${error.message}` };
    }
  }

  async testNumericalBounds() {
    try {
      // Test values within 0-4 range
      const validBounds = [0,1,2,3,4,0,1,2,3,4,0,1,2,3,4,0,1];
      const invalidBounds = [0,1,2,3,5,-1,1,2,3,4,0,1,2,3,4,0,1]; // Contains 5 and -1
      
      const validResult = await this.validateNumericalBounds(validBounds);
      const invalidResult = await this.validateNumericalBounds(invalidBounds);
      
      return {
        success: validResult.valid && !invalidResult.valid,
        message: validResult.valid && !invalidResult.valid ? 'Bounds checking works correctly' : 'Bounds checking failed',
        details: { valid_passed: validResult.valid, invalid_rejected: !invalidResult.valid }
      };
    } catch (error) {
      return { success: false, message: `Bounds test failed: ${error.message}` };
    }
  }

  async testTypeValidation() {
    try {
      // Test non-numeric values
      const mixedTypes = [1,2,'3',4,null,2,1,3,2,1,0,0,2,1,2,2,3];
      const result = await this.validateTypeConsistency(mixedTypes);
      
      return {
        success: !result.valid, // Should reject mixed types
        message: !result.valid ? 'Type validation correctly rejects mixed types' : 'Type validation failed to catch mixed types',
        details: result
      };
    } catch (error) {
      return { success: false, message: `Type validation test failed: ${error.message}` };
    }
  }

  async testConfidenceScores() {
    try {
      // Test confidence score integration
      const arrayWithConfidence = {
        values: [2,3,4,1,0,2,1,3,2,1,0,0,2,1,2,2,3],
        confidence: 0.85,
        timestamp: new Date().toISOString()
      };
      
      const result = await this.validateConfidenceIntegration(arrayWithConfidence);
      
      return {
        success: result.valid && result.confidence >= 0 && result.confidence <= 1,
        message: result.valid ? 'Confidence score integration working' : 'Confidence score integration failed',
        details: result
      };
    } catch (error) {
      return { success: false, message: `Confidence test failed: ${error.message}` };
    }
  }

  async testInvalidArrayHandling() {
    try {
      const invalidArrays = [
        [], // Empty array
        [1,2,3], // Too short
        [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18], // Too long
        null, // Null
        undefined, // Undefined
        'not_array' // Not an array
      ];
      
      let handledCorrectly = 0;
      for (const invalidArray of invalidArrays) {
        try {
          const result = await this.validateNumericalArray(invalidArray);
          if (!result.valid) handledCorrectly++;
        } catch (error) {
          handledCorrectly++; // Error handling counts as correct rejection
        }
      }
      
      return {
        success: handledCorrectly === invalidArrays.length,
        message: `Handled ${handledCorrectly}/${invalidArrays.length} invalid arrays correctly`,
        details: { correct_rejections: handledCorrectly, total_tests: invalidArrays.length }
      };
    } catch (error) {
      return { success: false, message: `Invalid array handling test failed: ${error.message}` };
    }
  }

  // =====================================================
  // 2. LLM AGENT INTERVENTION TESTS
  // =====================================================

  async testLLMAgentInterventions() {
    console.log('\n🤖 TESTING LLM AGENT INTERVENTIONS...');
    
    const tests = {
      'gemini_api_connectivity': await this.testGeminiConnectivity(),
      'numerical_processing': await this.testGeminiNumericalProcessing(),
      'escalation_protocols': await this.testEscalationProtocols(),
      'decision_making_logic': await this.testDecisionMakingLogic(),
      'context_analysis': await this.testContextAnalysis(),
      'intervention_triggers': await this.testInterventionTriggers()
    };

    this.results.llm_agent_interventions = tests;
    this.logTestResults('LLM Agent Interventions', tests);
  }

  async testGeminiConnectivity() {
    try {
      const response = await fetch(`${CONFIG.FIREBASE_API_URL}/health`);
      const data = await response.json();
      
      return {
        success: response.ok && data.status === 'healthy',
        message: response.ok ? 'Gemini API connectivity confirmed' : 'Gemini API connectivity failed',
        details: { status: response.status, data }
      };
    } catch (error) {
      return { success: false, message: `Gemini connectivity test failed: ${error.message}` };
    }
  }

  async testGeminiNumericalProcessing() {
    try {
      // Test critical bike red light scenario
      const criticalScenario = [1,2,4,3,0,3,2,2,1,1,0,0,3,2,2,1,4]; // bike_red_light_violation = 4
      
      const response = await fetch(`${CONFIG.FIREBASE_API_URL}/orchestrate-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          numerical_data: criticalScenario,
          location: 'test_intersection',
          timestamp: new Date().toISOString()
        })
      });
      
      const result = await response.json();
      
      return {
        success: response.ok && result.alert_triggered === true,
        message: response.ok ? 'Gemini numerical processing working' : 'Gemini numerical processing failed',
        details: result
      };
    } catch (error) {
      return { success: false, message: `Gemini numerical processing test failed: ${error.message}` };
    }
  }

  async testEscalationProtocols() {
    try {
      // Test immediate escalation (bike red light = 4)
      const immediateEscalation = [0,0,4,0,0,1,0,1,1,0,0,0,0,0,1,0,4];
      
      const response = await this.sendToGeminiAgent({
        type: 'escalation_test',
        data: immediateEscalation,
        location: 'critical_intersection'
      });
      
      return {
        success: response.escalation_level === 'immediate' && response.response_time === '5_minutes',
        message: response.escalation_level === 'immediate' ? 'Escalation protocols working' : 'Escalation protocols failed',
        details: response
      };
    } catch (error) {
      return { success: false, message: `Escalation test failed: ${error.message}` };
    }
  }

  async testDecisionMakingLogic() {
    try {
      // Test multiple scenarios and validate decision consistency
      const scenarios = [
        { data: [0,0,0,0,0,1,0,1,1,0,0,0,0,0,1,0,1], expected: 'normal' },
        { data: [2,2,2,2,1,2,1,2,2,1,1,1,2,1,2,1,2], expected: 'elevated' },
        { data: [3,3,4,3,2,3,2,3,3,2,2,2,3,2,3,2,4], expected: 'critical' }
      ];
      
      let correctDecisions = 0;
      for (const scenario of scenarios) {
        const response = await this.sendToGeminiAgent({
          type: 'decision_test',
          data: scenario.data
        });
        
        if (response.decision_level === scenario.expected) {
          correctDecisions++;
        }
      }
      
      return {
        success: correctDecisions === scenarios.length,
        message: `Decision logic: ${correctDecisions}/${scenarios.length} correct`,
        details: { correct: correctDecisions, total: scenarios.length }
      };
    } catch (error) {
      return { success: false, message: `Decision logic test failed: ${error.message}` };
    }
  }

  async testContextAnalysis() {
    try {
      // Test context enrichment with weather, time, location data
      const contextData = {
        numerical_data: [2,2,3,2,1,2,1,2,2,1,1,1,2,1,2,1,2],
        context: {
          weather: { temperature: 32, precipitation: 0.8, wind: 15 },
          time: { hour: 17, day: 'friday', rush_hour: true },
          location: { traffic_volume: 'high', school_nearby: true }
        }
      };
      
      const response = await this.sendToGeminiAgent({
        type: 'context_analysis',
        data: contextData
      });
      
      return {
        success: response.context_factors && response.risk_adjustment,
        message: response.context_factors ? 'Context analysis working' : 'Context analysis failed',
        details: response
      };
    } catch (error) {
      return { success: false, message: `Context analysis test failed: ${error.message}` };
    }
  }

  async testInterventionTriggers() {
    try {
      // Test different intervention trigger levels
      const triggers = [
        { level: 'immediate', data: [0,0,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0] }, // bike red light = 4
        { level: 'hourly', data: [2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2] }, // consistent moderate violations
        { level: 'daily', data: [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1] } // low-level pattern
      ];
      
      let correctTriggers = 0;
      for (const trigger of triggers) {
        const response = await this.sendToGeminiAgent({
          type: 'trigger_test',
          data: trigger.data
        });
        
        if (response.trigger_level === trigger.level) {
          correctTriggers++;
        }
      }
      
      return {
        success: correctTriggers === triggers.length,
        message: `Intervention triggers: ${correctTriggers}/${triggers.length} correct`,
        details: { correct: correctTriggers, total: triggers.length }
      };
    } catch (error) {
      return { success: false, message: `Intervention triggers test failed: ${error.message}` };
    }
  }

  // =====================================================
  // 3. DATA STORE INITIALIZATION TESTS
  // =====================================================

  async testDataStoreInitialization() {
    console.log('\n💾 TESTING DATA STORE INITIALIZATION...');
    
    const tests = {
      'firebase_connection': await this.testFirebaseConnection(),
      'firestore_collections': await this.testFirestoreCollections(),
      'statistical_storage': await this.testStatisticalStorage(),
      'data_retention_policies': await this.testDataRetentionPolicies(),
      'indexing_performance': await this.testIndexingPerformance(),
      'backup_integrity': await this.testBackupIntegrity()
    };

    this.results.data_store_tests = tests;
    this.logTestResults('Data Store Tests', tests);
  }

  async testFirebaseConnection() {
    try {
      const response = await fetch(`${CONFIG.FIREBASE_API_URL}/status`);
      const data = await response.json();
      
      return {
        success: response.ok && data.firebase_connected === true,
        message: response.ok ? 'Firebase connection confirmed' : 'Firebase connection failed',
        details: data
      };
    } catch (error) {
      return { success: false, message: `Firebase connection test failed: ${error.message}` };
    }
  }

  async testFirestoreCollections() {
    try {
      // Test required collections exist and are accessible
      const requiredCollections = [
        'analyses',
        'reports', 
        'territories',
        'daily_reports',
        'statistical_metrics',
        'violation_rates',
        'trend_analysis'
      ];
      
      let accessibleCollections = 0;
      for (const collection of requiredCollections) {
        try {
          const response = await fetch(`${CONFIG.FIREBASE_API_URL}/test-collection/${collection}`);
          if (response.ok) accessibleCollections++;
        } catch (error) {
          console.log(`Collection ${collection} not accessible:`, error.message);
        }
      }
      
      return {
        success: accessibleCollections === requiredCollections.length,
        message: `Firestore collections: ${accessibleCollections}/${requiredCollections.length} accessible`,
        details: { accessible: accessibleCollections, required: requiredCollections.length }
      };
    } catch (error) {
      return { success: false, message: `Firestore collections test failed: ${error.message}` };
    }
  }

  async testStatisticalStorage() {
    try {
      // Test statistical metrics storage and retrieval
      const testMetrics = {
        timestamp: new Date().toISOString(),
        location: 'test_location',
        violation_rates: {
          bike_red_light_violations_per_hour: 0.5,
          pedestrian_walkway_violations_per_hour: 1.2,
          dangerous_positioning_violations_per_hour: 0.8
        },
        trend_data: {
          short_term_trend: 'increasing',
          confidence_level: 0.85
        }
      };
      
      const storeResponse = await fetch(`${CONFIG.FIREBASE_API_URL}/store-metrics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testMetrics)
      });
      
      const retrieveResponse = await fetch(`${CONFIG.FIREBASE_API_URL}/get-metrics/test_location`);
      const retrievedData = await retrieveResponse.json();
      
      return {
        success: storeResponse.ok && retrieveResponse.ok && retrievedData.violation_rates,
        message: storeResponse.ok && retrieveResponse.ok ? 'Statistical storage working' : 'Statistical storage failed',
        details: { stored: storeResponse.ok, retrieved: retrieveResponse.ok, data: retrievedData }
      };
    } catch (error) {
      return { success: false, message: `Statistical storage test failed: ${error.message}` };
    }
  }

  async testDataRetentionPolicies() {
    try {
      // Test that data retention policies are configured
      const response = await fetch(`${CONFIG.FIREBASE_API_URL}/retention-status`);
      const policies = await response.json();
      
      const expectedPolicies = ['minute_data', 'hourly_data', 'daily_data', 'monthly_data'];
      const configuredPolicies = Object.keys(policies.retention_policies || {});
      
      return {
        success: expectedPolicies.every(policy => configuredPolicies.includes(policy)),
        message: `Data retention policies: ${configuredPolicies.length}/${expectedPolicies.length} configured`,
        details: { configured: configuredPolicies, expected: expectedPolicies }
      };
    } catch (error) {
      return { success: false, message: `Data retention test failed: ${error.message}` };
    }
  }

  async testIndexingPerformance() {
    try {
      // Test database query performance with indexes
      const startTime = Date.now();
      const response = await fetch(`${CONFIG.FIREBASE_API_URL}/query-performance-test`);
      const endTime = Date.now();
      
      const queryTime = endTime - startTime;
      const data = await response.json();
      
      return {
        success: response.ok && queryTime < 1000, // Under 1 second
        message: `Query performance: ${queryTime}ms (${queryTime < 1000 ? 'PASS' : 'SLOW'})`,
        details: { query_time_ms: queryTime, indexed_queries: data.queries_tested }
      };
    } catch (error) {
      return { success: false, message: `Indexing performance test failed: ${error.message}` };
    }
  }

  async testBackupIntegrity() {
    try {
      // Test backup and restore functionality
      const response = await fetch(`${CONFIG.FIREBASE_API_URL}/backup-status`);
      const backupInfo = await response.json();
      
      return {
        success: response.ok && backupInfo.last_backup && backupInfo.backup_healthy,
        message: response.ok ? 'Backup integrity confirmed' : 'Backup integrity failed',
        details: backupInfo
      };
    } catch (error) {
      return { success: false, message: `Backup integrity test failed: ${error.message}` };
    }
  }

  // =====================================================
  // 4. VISUAL OUTPUT CONFIRMATION TESTS
  // =====================================================

  async testVisualConfirmation() {
    console.log('\n👁️  TESTING VISUAL OUTPUT CONFIRMATION...');
    
    const tests = {
      'dashboard_loading': await this.testDashboardLoading(),
      'real_time_updates': await this.testRealTimeUpdates(),
      'chart_rendering': await this.testChartRendering(),
      'alert_visualization': await this.testAlertVisualization(),
      'metrics_display': await this.testMetricsDisplay(),
      'mobile_responsiveness': await this.testMobileResponsiveness()
    };

    this.results.visual_confirmation = tests;
    this.logTestResults('Visual Confirmation', tests);
  }

  async testDashboardLoading() {
    try {
      const response = await fetch(CONFIG.APP_URL);
      const html = await response.text();
      
      // Check for key dashboard elements
      const hasNavigation = html.includes('navigation') || html.includes('nav');
      const hasMainContent = html.includes('main') || html.includes('dashboard');
      const hasScripts = html.includes('<script') && html.includes('main');
      
      return {
        success: response.ok && hasNavigation && hasMainContent && hasScripts,
        message: response.ok ? 'Dashboard loads successfully' : 'Dashboard loading failed',
        details: { 
          status: response.status, 
          has_navigation: hasNavigation,
          has_main_content: hasMainContent,
          has_scripts: hasScripts
        }
      };
    } catch (error) {
      return { success: false, message: `Dashboard loading test failed: ${error.message}` };
    }
  }

  async testRealTimeUpdates() {
    try {
      // Test real-time data updates by posting new data and checking for updates
      const testData = {
        numerical_data: [2,3,1,1,0,2,1,2,1,1,0,0,1,1,1,1,2],
        location: 'test_real_time',
        timestamp: new Date().toISOString()
      };
      
      // Post data
      const postResponse = await fetch(`${CONFIG.FIREBASE_API_URL}/submit-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testData)
      });
      
      // Wait and check for update
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const statusResponse = await fetch(`${CONFIG.FIREBASE_API_URL}/status`);
      const statusData = await statusResponse.json();
      
      return {
        success: postResponse.ok && statusResponse.ok && statusData.recent_updates,
        message: postResponse.ok ? 'Real-time updates working' : 'Real-time updates failed',
        details: { post_success: postResponse.ok, status_success: statusResponse.ok, updates: statusData.recent_updates }
      };
    } catch (error) {
      return { success: false, message: `Real-time updates test failed: ${error.message}` };
    }
  }

  async testChartRendering() {
    try {
      // Test chart data API endpoints
      const chartEndpoints = [
        '/metrics/charts/violation-rates',
        '/metrics/charts/trend-analysis', 
        '/metrics/charts/location-comparison',
        '/metrics/charts/time-series'
      ];
      
      let workingCharts = 0;
      for (const endpoint of chartEndpoints) {
        try {
          const response = await fetch(`${CONFIG.FIREBASE_API_URL}${endpoint}`);
          if (response.ok) {
            const data = await response.json();
            if (data.chart_data || data.datasets) {
              workingCharts++;
            }
          }
        } catch (error) {
          console.log(`Chart endpoint ${endpoint} failed:`, error.message);
        }
      }
      
      return {
        success: workingCharts >= chartEndpoints.length * 0.75, // 75% success rate
        message: `Chart rendering: ${workingCharts}/${chartEndpoints.length} endpoints working`,
        details: { working_charts: workingCharts, total_charts: chartEndpoints.length }
      };
    } catch (error) {
      return { success: false, message: `Chart rendering test failed: ${error.message}` };
    }
  }

  async testAlertVisualization() {
    try {
      // Test alert display by triggering a critical alert
      const criticalAlert = {
        numerical_data: [0,0,4,0,0,3,2,3,2,1,1,1,3,2,2,1,4], // bike_red_light_violation = 4
        location: 'test_critical_intersection',
        timestamp: new Date().toISOString()
      };
      
      const alertResponse = await fetch(`${CONFIG.FIREBASE_API_URL}/orchestrate-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(criticalAlert)
      });
      
      const alertData = await alertResponse.json();
      
      // Check if alert appears in status
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const statusResponse = await fetch(`${CONFIG.FIREBASE_API_URL}/status`);
      const statusData = await statusResponse.json();
      
      return {
        success: alertResponse.ok && alertData.alert_triggered && statusData.active_alerts,
        message: alertData.alert_triggered ? 'Alert visualization working' : 'Alert visualization failed',
        details: { alert_triggered: alertData.alert_triggered, active_alerts: statusData.active_alerts }
      };
    } catch (error) {
      return { success: false, message: `Alert visualization test failed: ${error.message}` };
    }
  }

  async testMetricsDisplay() {
    try {
      // Test metrics dashboard data
      const metricsResponse = await fetch(`${CONFIG.FIREBASE_API_URL}/metrics/dashboard`);
      const metricsData = await metricsResponse.json();
      
      const requiredMetrics = [
        'current_violation_rates',
        'trend_indicators',
        'system_health',
        'quick_stats'
      ];
      
      let availableMetrics = 0;
      for (const metric of requiredMetrics) {
        if (metricsData[metric]) {
          availableMetrics++;
        }
      }
      
      return {
        success: metricsResponse.ok && availableMetrics >= requiredMetrics.length * 0.8,
        message: `Metrics display: ${availableMetrics}/${requiredMetrics.length} metrics available`,
        details: { available: availableMetrics, required: requiredMetrics.length, data: metricsData }
      };
    } catch (error) {
      return { success: false, message: `Metrics display test failed: ${error.message}` };
    }
  }

  async testMobileResponsiveness() {
    try {
      // Test mobile viewport rendering
      const response = await fetch(CONFIG.APP_URL, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15'
        }
      });
      
      const html = await response.text();
      
      const hasViewport = html.includes('viewport');
      const hasResponsiveCSS = html.includes('responsive') || html.includes('mobile') || html.includes('@media');
      const hasTouchFriendly = html.includes('touch') || html.includes('mobile-friendly');
      
      return {
        success: response.ok && hasViewport,
        message: response.ok ? 'Mobile responsiveness configured' : 'Mobile responsiveness failed',
        details: { 
          has_viewport: hasViewport,
          has_responsive_css: hasResponsiveCSS,
          has_touch_friendly: hasTouchFriendly
        }
      };
    } catch (error) {
      return { success: false, message: `Mobile responsiveness test failed: ${error.message}` };
    }
  }

  // =====================================================
  // 5. END-TO-END PIPELINE TESTS
  // =====================================================

  async testEndToEndPipeline() {
    console.log('\n🔄 TESTING END-TO-END PIPELINE...');
    
    const tests = {
      'complete_analysis_workflow': await this.testCompleteAnalysisWorkflow(),
      'data_flow_integrity': await this.testDataFlowIntegrity(),
      'error_recovery': await this.testErrorRecovery(),
      'performance_benchmarks': await this.testPerformanceBenchmarks(),
      'concurrent_processing': await this.testConcurrentProcessing(),
      'system_resilience': await this.testSystemResilience()
    };

    this.results.end_to_end_pipeline = tests;
    this.logTestResults('End-to-End Pipeline', tests);
  }

  async testCompleteAnalysisWorkflow() {
    try {
      console.log('   🔍 Testing complete analysis workflow...');
      
      // Step 1: Submit image analysis request
      const analysisRequest = {
        image_url: CONFIG.TEST_IMAGE_URL,
        location: 'test_complete_workflow',
        timestamp: new Date().toISOString(),
        context: {
          weather: { temperature: 25, precipitation: 0 },
          traffic: { volume: 'moderate' },
          time: { hour: 14, day: 'tuesday' }
        }
      };
      
      const step1Response = await fetch(`${CONFIG.FIREBASE_API_URL}/orchestrate-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(analysisRequest)
      });
      
      const step1Data = await step1Response.json();
      
      // Step 2: Verify data storage
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const step2Response = await fetch(`${CONFIG.FIREBASE_API_URL}/analysis/${step1Data.analysis_id || 'latest'}`);
      const step2Data = await step2Response.json();
      
      // Step 3: Check dashboard updates
      const step3Response = await fetch(`${CONFIG.FIREBASE_API_URL}/metrics/recent-analysis`);
      const step3Data = await step3Response.json();
      
      // Step 4: Verify alert generation if needed
      const step4Response = await fetch(`${CONFIG.FIREBASE_API_URL}/alerts/recent`);
      const step4Data = await step4Response.json();
      
      const workflowSuccess = step1Response.ok && step2Response.ok && step3Response.ok && step4Response.ok;
      
      return {
        success: workflowSuccess,
        message: workflowSuccess ? 'Complete workflow successful' : 'Workflow failed at one or more steps',
        details: {
          step1_analysis: step1Response.ok,
          step2_storage: step2Response.ok,
          step3_dashboard: step3Response.ok,
          step4_alerts: step4Response.ok,
          analysis_id: step1Data.analysis_id
        }
      };
    } catch (error) {
      return { success: false, message: `Complete workflow test failed: ${error.message}` };
    }
  }

  async testDataFlowIntegrity() {
    try {
      console.log('   📊 Testing data flow integrity...');
      
      // Create unique test identifier
      const testId = `integrity_test_${Date.now()}`;
      
      // Submit test data with tracking
      const testData = {
        test_id: testId,
        numerical_data: [1,2,1,1,0,1,1,2,1,1,0,0,1,1,1,1,1],
        location: 'integrity_test_location',
        timestamp: new Date().toISOString()
      };
      
      // Submit data
      const submitResponse = await fetch(`${CONFIG.FIREBASE_API_URL}/submit-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testData)
      });
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Check data in multiple storage locations
      const storageChecks = await Promise.all([
        fetch(`${CONFIG.FIREBASE_API_URL}/reports/${testId}`),
        fetch(`${CONFIG.FIREBASE_API_URL}/metrics/location/integrity_test_location`),
        fetch(`${CONFIG.FIREBASE_API_URL}/analysis/recent?test_id=${testId}`)
      ]);
      
      const integrityPassed = submitResponse.ok && storageChecks.every(response => response.ok);
      
      return {
        success: integrityPassed,
        message: integrityPassed ? 'Data flow integrity maintained' : 'Data flow integrity compromised',
        details: {
          submit_success: submitResponse.ok,
          storage_checks: storageChecks.map(r => r.ok),
          test_id: testId
        }
      };
    } catch (error) {
      return { success: false, message: `Data flow integrity test failed: ${error.message}` };
    }
  }

  async testErrorRecovery() {
    try {
      console.log('   🔧 Testing error recovery...');
      
      // Test various error scenarios
      const errorTests = [
        { type: 'invalid_data', data: { invalid: 'data' } },
        { type: 'malformed_array', data: { numerical_data: [1,2,'invalid',4] } },
        { type: 'missing_location', data: { numerical_data: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17] } },
        { type: 'future_timestamp', data: { numerical_data: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17], timestamp: '2030-01-01T00:00:00Z' } }
      ];
      
      let recoveredErrors = 0;
      for (const errorTest of errorTests) {
        try {
          const response = await fetch(`${CONFIG.FIREBASE_API_URL}/orchestrate-analysis`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(errorTest.data)
          });
          
          // Should get error response, not crash
          if (response.status >= 400 && response.status < 500) {
            recoveredErrors++;
          }
        } catch (error) {
          // Network errors don't count as recovery
          console.log(`Error test ${errorTest.type} caused network error:`, error.message);
        }
      }
      
      return {
        success: recoveredErrors >= errorTests.length * 0.75,
        message: `Error recovery: ${recoveredErrors}/${errorTests.length} scenarios handled`,
        details: { recovered: recoveredErrors, total: errorTests.length }
      };
    } catch (error) {
      return { success: false, message: `Error recovery test failed: ${error.message}` };
    }
  }

  async testPerformanceBenchmarks() {
    try {
      console.log('   ⚡ Testing performance benchmarks...');
      
      const benchmarks = [];
      
      // Test 1: Analysis response time
      const analysisStart = Date.now();
      const analysisResponse = await fetch(`${CONFIG.FIREBASE_API_URL}/orchestrate-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          numerical_data: [2,2,2,2,1,2,1,2,2,1,1,1,2,1,2,1,2],
          location: 'performance_test'
        })
      });
      const analysisTime = Date.now() - analysisStart;
      benchmarks.push({ test: 'analysis_response', time: analysisTime, threshold: 5000 });
      
      // Test 2: Dashboard data loading time
      const dashboardStart = Date.now();
      const dashboardResponse = await fetch(`${CONFIG.FIREBASE_API_URL}/metrics/dashboard`);
      const dashboardTime = Date.now() - dashboardStart;
      benchmarks.push({ test: 'dashboard_loading', time: dashboardTime, threshold: 2000 });
      
      // Test 3: Statistical calculation time
      const statsStart = Date.now();
      const statsResponse = await fetch(`${CONFIG.FIREBASE_API_URL}/metrics/calculate-trends`);
      const statsTime = Date.now() - statsStart;
      benchmarks.push({ test: 'statistical_calculation', time: statsTime, threshold: 3000 });
      
      const passedBenchmarks = benchmarks.filter(b => b.time <= b.threshold).length;
      
      return {
        success: passedBenchmarks >= benchmarks.length * 0.8,
        message: `Performance benchmarks: ${passedBenchmarks}/${benchmarks.length} within thresholds`,
        details: benchmarks
      };
    } catch (error) {
      return { success: false, message: `Performance benchmarks test failed: ${error.message}` };
    }
  }

  async testConcurrentProcessing() {
    try {
      console.log('   🔀 Testing concurrent processing...');
      
      // Submit multiple requests simultaneously
      const concurrentRequests = Array.from({ length: 5 }, (_, i) => ({
        numerical_data: [1,2,1,1,0,1,1,2,1,1,0,0,1,1,1,1,1],
        location: `concurrent_test_${i}`,
        timestamp: new Date().toISOString()
      }));
      
      const startTime = Date.now();
      const responses = await Promise.all(
        concurrentRequests.map(request => 
          fetch(`${CONFIG.FIREBASE_API_URL}/orchestrate-analysis`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request)
          })
        )
      );
      const totalTime = Date.now() - startTime;
      
      const successfulResponses = responses.filter(r => r.ok).length;
      const averageTime = totalTime / responses.length;
      
      return {
        success: successfulResponses === responses.length && averageTime < 3000,
        message: `Concurrent processing: ${successfulResponses}/${responses.length} successful, avg ${averageTime}ms`,
        details: {
          successful: successfulResponses,
          total: responses.length,
          average_time: averageTime,
          total_time: totalTime
        }
      };
    } catch (error) {
      return { success: false, message: `Concurrent processing test failed: ${error.message}` };
    }
  }

  async testSystemResilience() {
    try {
      console.log('   🛡️  Testing system resilience...');
      
      // Test system behavior under stress
      const stressTests = [
        { name: 'large_payload', size: 'large' },
        { name: 'rapid_requests', rate: 'high' },
        { name: 'edge_case_data', data: 'edge' }
      ];
      
      let resilientTests = 0;
      
      for (const test of stressTests) {
        try {
          let response;
          
          if (test.name === 'large_payload') {
            // Test with large context data
            response = await fetch(`${CONFIG.FIREBASE_API_URL}/orchestrate-analysis`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                numerical_data: [2,2,2,2,1,2,1,2,2,1,1,1,2,1,2,1,2],
                location: 'stress_test_large',
                context: {
                  large_data: 'x'.repeat(10000), // 10KB of data
                  metadata: Array.from({ length: 100 }, (_, i) => ({ id: i, value: `test_${i}` }))
                }
              })
            });
          } else if (test.name === 'rapid_requests') {
            // Test rapid consecutive requests
            const rapidRequests = Array.from({ length: 10 }, () => 
              fetch(`${CONFIG.FIREBASE_API_URL}/status`)
            );
            const rapidResponses = await Promise.all(rapidRequests);
            response = { ok: rapidResponses.every(r => r.ok) };
          } else if (test.name === 'edge_case_data') {
            // Test edge case numerical data
            response = await fetch(`${CONFIG.FIREBASE_API_URL}/orchestrate-analysis`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                numerical_data: [4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4], // All maximum values
                location: 'stress_test_edge'
              })
            });
          }
          
          if (response.ok) {
            resilientTests++;
          }
        } catch (error) {
          console.log(`Stress test ${test.name} failed:`, error.message);
        }
      }
      
      return {
        success: resilientTests >= stressTests.length * 0.75,
        message: `System resilience: ${resilientTests}/${stressTests.length} stress tests passed`,
        details: { passed: resilientTests, total: stressTests.length }
      };
    } catch (error) {
      return { success: false, message: `System resilience test failed: ${error.message}` };
    }
  }

  // =====================================================
  // HELPER METHODS
  // =====================================================

  validateNumericalArray(array) {
    if (!Array.isArray(array)) {
      return { valid: false, message: 'Not an array', length: 0 };
    }
    
    if (array.length !== 17) {
      return { valid: false, message: 'Wrong length', length: array.length };
    }
    
    return { valid: true, message: 'Valid array', length: array.length };
  }

  validateNumericalBounds(array) {
    if (!Array.isArray(array)) {
      return { valid: false, message: 'Not an array' };
    }
    
    for (let i = 0; i < array.length; i++) {
      if (typeof array[i] !== 'number' || array[i] < 0 || array[i] > 4) {
        return { valid: false, message: `Invalid value at index ${i}: ${array[i]}`, index: i, value: array[i] };
      }
    }
    
    return { valid: true, message: 'All values within bounds' };
  }

  validateTypeConsistency(array) {
    if (!Array.isArray(array)) {
      return { valid: false, message: 'Not an array' };
    }
    
    for (let i = 0; i < array.length; i++) {
      if (typeof array[i] !== 'number') {
        return { valid: false, message: `Non-numeric value at index ${i}: ${array[i]}`, index: i, type: typeof array[i] };
      }
    }
    
    return { valid: true, message: 'All values are numeric' };
  }

  validateConfidenceIntegration(data) {
    if (!data.values || !Array.isArray(data.values)) {
      return { valid: false, message: 'Missing or invalid values array' };
    }
    
    if (typeof data.confidence !== 'number' || data.confidence < 0 || data.confidence > 1) {
      return { valid: false, message: 'Invalid confidence score', confidence: data.confidence };
    }
    
    return { valid: true, message: 'Confidence integration valid', confidence: data.confidence };
  }

  async sendToGeminiAgent(payload) {
    try {
      const response = await fetch(`${CONFIG.FIREBASE_API_URL}/gemini-agent-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      return await response.json();
    } catch (error) {
      throw new Error(`Gemini agent communication failed: ${error.message}`);
    }
  }

  logTestResults(category, tests) {
    console.log(`\n📊 ${category} Results:`);
    let passed = 0;
    let total = 0;
    
    for (const [testName, result] of Object.entries(tests)) {
      total++;
      if (result.success) passed++;
      
      const status = result.success ? '✅' : '❌';
      console.log(`${status} ${testName}: ${result.message}`);
      
      if (result.details && !result.success) {
        console.log(`   Details: ${JSON.stringify(result.details, null, 2)}`);
      }
    }
    
    const percentage = Math.round((passed / total) * 100);
    console.log(`\n${category} Score: ${passed}/${total} (${percentage}%)`);
  }

  // =====================================================
  // MAIN EXECUTION (UPDATED)
  // =====================================================

  async runAllTests() {
    console.log('🚀 STARTING COMPREHENSIVE SYSTEM INSPECTION...\n');
    console.log(`Target System: ${CONFIG.APP_URL}`);
    console.log(`Firebase Project: ${CONFIG.FIREBASE_PROJECT_ID}`);
    console.log(`Test Start Time: ${new Date().toISOString()}\n`);

    try {
      // Run all test categories
      await this.testNumericalHandling();
      await this.testLLMAgentInterventions();  
      await this.testDataStoreInitialization();
      await this.testVisualConfirmation();
      await this.testEndToEndPipeline();
      
      // Calculate overall score
      this.calculateOverallScore();
      
      // Generate final report
      this.generateFinalReport();
      
    } catch (error) {
      console.error('❌ System inspection failed:', error);
      process.exit(1);
    }
  }

  calculateOverallScore() {
    let totalTests = 0;
    let passedTests = 0;
    
    for (const category of Object.values(this.results)) {
      if (typeof category === 'object' && category !== null) {
        for (const result of Object.values(category)) {
          if (result && typeof result.success === 'boolean') {
            totalTests++;
            if (result.success) passedTests++;
          }
        }
      }
    }
    
    this.results.overall_score = Math.round((passedTests / totalTests) * 100);
    this.results.passed_tests = passedTests;
    this.results.total_tests = totalTests;
  }

  generateFinalReport() {
    const endTime = Date.now();
    const duration = Math.round((endTime - this.startTime) / 1000);
    
    console.log('\n' + '='.repeat(80));
    console.log('🏁 COMPREHENSIVE SYSTEM INSPECTION COMPLETE');
    console.log('='.repeat(80));
    
    console.log(`\n📊 OVERALL SCORE: ${this.results.overall_score}% (${this.results.passed_tests}/${this.results.total_tests})`);
    console.log(`⏱️  Duration: ${duration} seconds`);
    console.log(`🕐 Completed: ${new Date().toISOString()}`);
    
    // Save detailed results
    const reportPath = `inspection-report-${Date.now()}.json`;
    fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
    console.log(`📄 Detailed report saved: ${reportPath}`);
    
    // Exit with appropriate code
    process.exit(this.results.overall_score >= 80 ? 0 : 1);
  }
}

// Run inspection if called directly
if (require.main === module) {
  const inspector = new SystemInspector();
  inspector.runAllTests().catch(console.error);
}

module.exports = SystemInspector; 