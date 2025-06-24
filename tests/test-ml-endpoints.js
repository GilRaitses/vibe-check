/**
 * TEST ML ENDPOINTS
 * 
 * Test script to verify BigQuery ML integration is working
 */

const BASE_URL = 'https://us-central1-vibe-check-463816.cloudfunctions.net/api';

// Test data
const testViolationData = {
  numerical_data: [2, 3, 4, 1, 0, 3, 2, 2, 1, 2, 1, 0, 2, 1, 2, 1, 3], // Bike red light = 4 (critical)
  location: 'hells_kitchen_test',
  context: {
    weather: { temp: 25, rain: 0 },
    time: { hour: 17, day: 'monday' }
  }
};

async function testMLPredict() {
  console.log('🧠 Testing ML Prediction Endpoint...');
  
  try {
    const response = await fetch(`${BASE_URL}/ml-predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testViolationData)
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ ML Prediction Success!');
      console.log('   Model Used:', data.model_used);
      console.log('   ML Classification:', data.decision.ml_classification?.predicted_severity);
      console.log('   ML Confidence:', data.decision.ml_classification?.confidence);
      console.log('   Rule-based Urgency:', data.decision.rule_based_urgency);
      console.log('   Combined Action:', data.decision.combined_recommendation.action);
      console.log('   ML Enhanced:', data.decision.combined_recommendation.ml_enhanced);
      
      return { success: true, data };
    } else {
      console.log('❌ ML Prediction Failed:', data.error);
      return { success: false, error: data.error };
    }
  } catch (error) {
    console.log('❌ ML Prediction Error:', error.message);
    return { success: false, error: error.message };
  }
}

async function testMLForecast() {
  console.log('\n📈 Testing ML Forecast Endpoint...');
  
  try {
    const response = await fetch(`${BASE_URL}/ml-forecast/hells_kitchen_test`);
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ ML Forecast Success!');
      console.log('   Location:', data.location);
      console.log('   Forecast Horizon:', data.forecast.forecast_horizon_hours, 'hours');
      console.log('   Predictions Count:', data.forecast.predictions.length);
      console.log('   Confidence:', data.forecast.confidence);
      
      if (data.forecast.predictions.length > 0) {
        console.log('   Next Prediction:', data.forecast.predictions[0]);
      }
      
      return { success: true, data };
    } else {
      console.log('❌ ML Forecast Failed:', data.error);
      return { success: false, error: data.error };
    }
  } catch (error) {
    console.log('❌ ML Forecast Error:', error.message);
    return { success: false, error: error.message };
  }
}

async function testMLStats() {
  console.log('\n📊 Testing ML Stats Endpoint...');
  
  try {
    const response = await fetch(`${BASE_URL}/ml-stats`);
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ ML Stats Success!');
      console.log('   Models Evaluated:', data.model_performance.models_evaluated);
      console.log('   Last Updated:', data.last_updated);
      
      if (data.model_performance.evaluation_results) {
        console.log('   Evaluation Results Available:', data.model_performance.evaluation_results.length > 0);
      }
      
      return { success: true, data };
    } else {
      console.log('❌ ML Stats Failed:', data.error);
      return { success: false, error: data.error };
    }
  } catch (error) {
    console.log('❌ ML Stats Error:', error.message);
    return { success: false, error: error.message };
  }
}

async function testComparison() {
  console.log('\n🔄 Testing Comparison: Regular vs ML-Enhanced...');
  
  try {
    // Test regular endpoint
    const regularResponse = await fetch(`${BASE_URL}/orchestrate-analysis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testViolationData)
    });
    
    const regularData = await regularResponse.json();
    
    // Test ML endpoint
    const mlResponse = await fetch(`${BASE_URL}/ml-predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testViolationData)
    });
    
    const mlData = await mlResponse.json();
    
    console.log('📊 Comparison Results:');
    console.log('   Regular Endpoint:', {
      alert_triggered: regularData.alert_triggered,
      risk_level: regularData.analysis?.risk_level,
      processing_method: 'rule_based'
    });
    
    console.log('   ML-Enhanced Endpoint:', {
      ml_enhanced: mlData.decision?.combined_recommendation?.ml_enhanced,
      action: mlData.decision?.combined_recommendation?.action,
      confidence: mlData.decision?.combined_recommendation?.confidence,
      processing_method: mlData.model_used
    });
    
    return { success: true, both_working: regularResponse.ok && mlResponse.ok };
    
  } catch (error) {
    console.log('❌ Comparison Error:', error.message);
    return { success: false, error: error.message };
  }
}

async function runAllTests() {
  console.log('🚀 Starting ML Endpoints Test Suite...\n');
  console.log(`Testing against: ${BASE_URL}`);
  console.log(`Test data: Bike red light violation = 4 (critical)\n`);
  
  const results = {
    ml_predict: await testMLPredict(),
    ml_forecast: await testMLForecast(),
    ml_stats: await testMLStats(),
    comparison: await testComparison()
  };
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('🏁 ML ENDPOINTS TEST SUMMARY');
  console.log('='.repeat(60));
  
  const passedTests = Object.values(results).filter(r => r.success).length;
  const totalTests = Object.keys(results).length;
  
  console.log(`\n📊 Overall Score: ${passedTests}/${totalTests} (${Math.round(passedTests/totalTests*100)}%)`);
  
  Object.entries(results).forEach(([test, result]) => {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${test}: ${result.success ? 'PASS' : 'FAIL'}`);
    if (!result.success && result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });
  
  if (passedTests === totalTests) {
    console.log('\n🎉 All ML endpoints are working correctly!');
    console.log('Your BigQuery ML integration is ready for production use.');
  } else {
    console.log('\n⚠️  Some ML endpoints need attention.');
    console.log('This is normal if you just set up BigQuery - models need training data.');
  }
  
  console.log('\n📋 Next Steps:');
  console.log('1. Send more test data to build training dataset');
  console.log('2. Check BigQuery console for model training status');
  console.log('3. Monitor ML predictions vs rule-based decisions');
  
  return results;
}

// Run tests if called directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = { runAllTests, testMLPredict, testMLForecast, testMLStats }; 