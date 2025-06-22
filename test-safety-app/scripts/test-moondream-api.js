#!/usr/bin/env node

// Test script to verify Moondream API connection
// Run with: node scripts/test-moondream-api.js

require('dotenv').config();

const API_KEY = process.env.EXPO_PUBLIC_MOONDREAM_API_KEY || 'hyper-panther-270';
const BASE_URL = 'https://api.moondream.ai/v1';

console.log('🔧 [TEST] Starting Moondream API test...');
console.log('🔑 [TEST] Using API key:', API_KEY ? `${API_KEY.substring(0, 10)}...` : 'NOT FOUND');

async function testMoondreamAPI() {
  try {
    // Test 1: Simple API health check
    console.log('\n📡 [TEST] Testing API connection...');
    
    const testPayload = {
      image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", // 1x1 pixel
      question: "What do you see?",
      response_format: {
        type: "json_object",
        schema: {
          type: "object",
          properties: {
            test: { type: "number" }
          }
        }
      }
    };

    const response = await fetch(`${BASE_URL}/query`, {
      method: 'POST',
      headers: {
        'X-Moondream-Auth': API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testPayload)
    });

    console.log('📊 [TEST] Response status:', response.status);
    console.log('📊 [TEST] Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [TEST] API Error:', response.status, errorText);
      
      if (response.status === 401) {
        console.error('🔑 [TEST] Authentication failed - check API key');
        console.error('🔑 [TEST] Current key:', API_KEY);
      }
      
      return false;
    }

    const result = await response.json();
    console.log('✅ [TEST] API Response:', JSON.stringify(result, null, 2));
    
    // Test 2: Test with actual NYC camera image
    console.log('\n📸 [TEST] Testing with real NYC camera image...');
    
    const nycImageUrl = 'https://nyctmc.org/api/cameras/fcc24aa5-4da0-48f2-aa43-e70e4677517c/image';
    console.log('🔗 [TEST] Fetching image from:', nycImageUrl);
    
    const imageResponse = await fetch(nycImageUrl);
    if (!imageResponse.ok) {
      console.error('❌ [TEST] Failed to fetch NYC camera image:', imageResponse.status);
      return false;
    }
    
    const imageBlob = await imageResponse.blob();
    console.log('📦 [TEST] Image size:', (imageBlob.size / 1024).toFixed(1), 'KB');
    
    // Convert to base64 (Node.js compatible)
    const arrayBuffer = await imageBlob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Image = `data:${imageBlob.type};base64,${buffer.toString('base64')}`;
    
    console.log('🔄 [TEST] Converted to base64, length:', (base64Image.length / 1024).toFixed(1), 'KB');
    
    // Test vision analysis
    const visionPayload = {
      image: base64Image,
      question: "Count and analyze this traffic scene. Return JSON with: bikes_on_sidewalk (0-4), bikes_in_street (0-4), cars_count (0-4), pedestrians_count (0-4), traffic_density (0-4).",
      response_format: {
        type: "json_object",
        schema: {
          type: "object",
          properties: {
            bikes_on_sidewalk: { type: "number" },
            bikes_in_street: { type: "number" },
            cars_count: { type: "number" },
            pedestrians_count: { type: "number" },
            traffic_density: { type: "number" }
          }
        }
      }
    };

    console.log('🤖 [TEST] Sending vision analysis request...');
    const visionResponse = await fetch(`${BASE_URL}/query`, {
      method: 'POST',
      headers: {
        'X-Moondream-Auth': API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(visionPayload)
    });

    if (!visionResponse.ok) {
      const errorText = await visionResponse.text();
      console.error('❌ [TEST] Vision API Error:', visionResponse.status, errorText);
      return false;
    }

    const visionResult = await visionResponse.json();
    console.log('✅ [TEST] Vision Analysis Result:', JSON.stringify(visionResult, null, 2));
    
    // Parse the JSON response (handle markdown code blocks)
    let parsedAnswer;
    try {
      let answerText = visionResult.answer;
      
      // Remove markdown code blocks if present
      if (answerText.includes('```json')) {
        answerText = answerText.replace(/```json\s*/, '').replace(/\s*```$/, '');
      }
      
      parsedAnswer = typeof answerText === 'string' 
        ? JSON.parse(answerText) 
        : answerText;
      console.log('📊 [TEST] Parsed vision data:', parsedAnswer);
    } catch (parseError) {
      console.error('❌ [TEST] Failed to parse vision response:', parseError);
      console.error('📄 [TEST] Raw answer:', visionResult.answer);
      return false;
    }
    
    console.log('\n🎉 [TEST] All tests passed! Moondream API is working correctly.');
    return true;
    
  } catch (error) {
    console.error('❌ [TEST] Test failed with error:', error);
    return false;
  }
}

// Run the test
testMoondreamAPI().then(success => {
  if (success) {
    console.log('\n✅ [TEST] Moondream API test completed successfully!');
    process.exit(0);
  } else {
    console.log('\n❌ [TEST] Moondream API test failed!');
    process.exit(1);
  }
}); 