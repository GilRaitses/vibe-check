#!/usr/bin/env node

const { GoogleGenerativeAI } = require('@google/generative-ai');
const puppeteer = require('puppeteer');

// Initialize Gemini API
const genAI = new GoogleGenerativeAI('AIzaSyCmQpywkSrG_YH-JwaMkuYQ0dSFYC4zy_c');

const APP_URL = 'https://vibe-check-463816.web.app';

// Test conditions mapped to numerical indices
const TEST_CONDITIONS = {
  // Navigation (0-9)
  0: 'Navigation bar with "Vibe-Check" branding is visible',
  1: 'Navigation contains Dashboard link',
  2: 'Navigation contains Analysis link', 
  3: 'Navigation contains Reporting link',
  4: 'Navigation contains Map link',
  5: 'Navigation contains Territories link',
  
  // Map Page (10-19)
  10: 'Map page shows "NYC Territory Map" heading',
  11: 'Territory list is displayed with territory names',
  12: 'Safety scores are shown for territories (like 6/10, 8/10)',
  13: 'Territory descriptions are visible',
  14: 'Refresh Data button is present',
  15: 'Toggle View button is present',
  
  // Dashboard Page (20-29)  
  20: 'Dashboard shows "Vibe-Check Dashboard" heading',
  21: 'System Status card shows "Operational"',
  22: 'AI Services card shows Gemini AI and Vision API status',
  23: 'Data Sources card shows NYC Cameras and Firebase status',
  24: 'Quick Stats card shows territories count',
  25: 'About section explains the app purpose',
  
  // Analysis Page (30-39)
  30: 'Analysis page shows "Street Scene Analysis" heading',
  31: 'File upload area with drag & drop is visible',
  32: 'Upload icon and instructions are present',
  33: 'Choose File button is available',
  
  // Reporting Page (40-49)
  40: 'Reporting page shows "Report Safety Issue" heading',
  41: 'Location section with latitude/longitude inputs',
  42: 'Get Current Location button is present',
  43: 'Issue type dropdown with options',
  44: 'Severity level radio buttons (Low/Medium/High)',
  45: 'Description textarea is available',
  46: 'Submit Report button is present',
  
  // Error Conditions (90-99)
  90: 'Page shows Angular logo (default page)',
  91: 'Page is completely blank/white',
  92: 'Page shows error messages',
  93: 'Page fails to load',
  94: 'Navigation is missing completely'
};

async function testPage(browser, path, pageName, expectedConditions) {
  console.log(`\n🧪 Testing ${pageName} page: ${APP_URL}${path}`);
  
  const page = await browser.newPage();
  
  try {
    await page.goto(`${APP_URL}${path}`, { 
      waitUntil: 'networkidle2',
      timeout: 10000 
    });
    
    // Wait a bit for any dynamic content
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Get page content
    const content = await page.content();
    
    // Take screenshot
    const screenshot = await page.screenshot({ 
      fullPage: true,
      encoding: 'base64' 
    });
    
    // Send to Gemini for analysis
    const results = await analyzeWithGemini(content, screenshot, expectedConditions, pageName);
    
    return results;
    
  } catch (error) {
    console.error(`❌ Error testing ${pageName}:`, error.message);
    return { error: error.message, conditions: [] };
  } finally {
    await page.close();
  }
}

async function analyzeWithGemini(htmlContent, screenshot, expectedConditions, pageName) {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  
  const conditionsList = expectedConditions.map(idx => `${idx}: ${TEST_CONDITIONS[idx]}`).join('\n');
  
  const prompt = `You are testing a web application called "Vibe-Check" - an AI-powered street safety analysis tool for NYC.

TASK: Analyze this ${pageName} page and return ONLY the numerical indices of conditions that are TRUE/PRESENT.

TEST CONDITIONS TO CHECK:
${conditionsList}

RULES:
1. Return ONLY numbers (indices) that are actually present/true
2. Separate multiple numbers with commas
3. If NOTHING is present, return "NONE"
4. If you see the Angular logo or default Angular page, return "90"
5. If the page is blank/white, return "91"

EXAMPLE RESPONSE: "0,1,10,11,12" (if those conditions are met)

PAGE HTML CONTENT:
${htmlContent.substring(0, 5000)}`;

  try {
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: screenshot,
          mimeType: 'image/png'
        }
      }
    ]);
    
    const response = result.response.text().trim();
    console.log(`📊 Gemini Analysis: ${response}`);
    
    // Parse the response
    const foundConditions = response === 'NONE' ? [] : 
      response.split(',').map(num => parseInt(num.trim())).filter(num => !isNaN(num));
    
    return {
      raw: response,
      found: foundConditions,
      expected: expectedConditions,
      missing: expectedConditions.filter(idx => !foundConditions.includes(idx))
    };
    
  } catch (error) {
    console.error(`❌ Gemini API Error:`, error.message);
    return { error: error.message, found: [], expected: expectedConditions, missing: expectedConditions };
  }
}

function printResults(pageName, results) {
  console.log(`\n📋 ${pageName.toUpperCase()} RESULTS:`);
  console.log(`   Raw Response: ${results.raw || 'ERROR'}`);
  
  if (results.found && results.found.length > 0) {
    console.log(`   ✅ Found (${results.found.length}): ${results.found.map(idx => `${idx}: ${TEST_CONDITIONS[idx]}`).join(', ')}`);
  }
  
  if (results.missing && results.missing.length > 0) {
    console.log(`   ❌ Missing (${results.missing.length}): ${results.missing.map(idx => `${idx}: ${TEST_CONDITIONS[idx]}`).join(', ')}`);
  }
  
  if (results.error) {
    console.log(`   🚨 Error: ${results.error}`);
  }
  
  const successRate = results.expected ? 
    Math.round((results.found?.length || 0) / results.expected.length * 100) : 0;
  console.log(`   📊 Success Rate: ${successRate}%`);
}

async function runFullTest() {
  console.log('🚀 Starting Vibe-Check App Debug Test');
  console.log(`📱 Testing: ${APP_URL}`);
  
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const testPages = [
    { path: '/', name: 'Map (Default)', conditions: [0,1,2,3,4,5,10,11,12,13,14,15] },
    { path: '/dashboard', name: 'Dashboard', conditions: [0,1,2,3,4,5,20,21,22,23,24,25] },
    { path: '/analysis', name: 'Analysis', conditions: [0,1,2,3,4,5,30,31,32,33] },
    { path: '/reporting', name: 'Reporting', conditions: [0,1,2,3,4,5,40,41,42,43,44,45,46] }
  ];
  
  const allResults = {};
  
  for (const pageConfig of testPages) {
    const results = await testPage(browser, pageConfig.path, pageConfig.name, pageConfig.conditions);
    allResults[pageConfig.name] = results;
    printResults(pageConfig.name, results);
  }
  
  await browser.close();
  
  // Summary
  console.log('\n🎯 OVERALL SUMMARY:');
  let totalExpected = 0;
  let totalFound = 0;
  
  for (const [pageName, results] of Object.entries(allResults)) {
    if (results.expected && results.found) {
      totalExpected += results.expected.length;
      totalFound += results.found.length;
      const rate = Math.round(results.found.length / results.expected.length * 100);
      console.log(`   ${pageName}: ${results.found.length}/${results.expected.length} (${rate}%)`);
    }
  }
  
  const overallRate = totalExpected > 0 ? Math.round(totalFound / totalExpected * 100) : 0;
  console.log(`\n📊 OVERALL SUCCESS RATE: ${totalFound}/${totalExpected} (${overallRate}%)`);
  
  if (overallRate < 50) {
    console.log('🚨 CRITICAL: App is not functioning as expected');
  } else if (overallRate < 80) {
    console.log('⚠️  WARNING: App has significant issues');
  } else {
    console.log('✅ SUCCESS: App is mostly functional');
  }
}

// Run the test
runFullTest().catch(console.error); 