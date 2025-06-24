#!/usr/bin/env node

const { GoogleGenerativeAI } = require('@google/generative-ai');
const puppeteer = require('puppeteer');

// Initialize Gemini API
const genAI = new GoogleGenerativeAI('AIzaSyCmQpywkSrG_YH-JwaMkuYQ0dSFYC4zy_c');

const APP_URL = 'https://vibe-check-463816.web.app';

async function capturePageForAnalysis(browser, path, pageName) {
  console.log(`\n🔍 Capturing ${pageName} page: ${APP_URL}${path}`);
  
  const page = await browser.newPage();
  
  try {
    await page.goto(`${APP_URL}${path}`, { 
      waitUntil: 'networkidle2',
      timeout: 10000 
    });
    
    // Wait for dynamic content
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Get page content
    const content = await page.content();
    
    // Take screenshot
    const screenshot = await page.screenshot({ 
      fullPage: true,
      encoding: 'base64' 
    });
    
    // Get console errors
    const logs = [];
    page.on('console', msg => logs.push(`${msg.type()}: ${msg.text()}`));
    
    return {
      content,
      screenshot,
      logs,
      url: `${APP_URL}${path}`
    };
    
  } catch (error) {
    console.error(`❌ Error capturing ${pageName}:`, error.message);
    return { error: error.message };
  } finally {
    await page.close();
  }
}

async function getDetailedAnalysis(pageData, pageName, analysisType) {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  
  const prompts = {
    'visual': `You are a UX/UI expert analyzing the visual layout of a web application page.

CONTEXT: This is the "${pageName}" page of "Vibe-Check" - an AI-powered NYC street safety analysis app.

TASK: Provide a detailed visual analysis focusing on:
1. **Layout & Design**: What do you see? Is the layout clean and organized?
2. **Navigation**: Is there a navigation bar? What links are visible?
3. **Content Structure**: What are the main sections/components?
4. **Visual Issues**: Any broken layouts, missing elements, or visual problems?
5. **User Experience**: How intuitive does the interface appear?

FORMAT: Provide specific observations, not general comments.`,

    'functional': `You are a web application QA engineer analyzing functionality.

CONTEXT: This is the "${pageName}" page of "Vibe-Check" - an AI-powered NYC street safety analysis app.

TASK: Analyze the functional elements:
1. **Interactive Elements**: What buttons, forms, inputs are present?
2. **Data Display**: What information/data is being shown?
3. **User Actions**: What can a user actually do on this page?
4. **Missing Functionality**: What seems broken or incomplete?
5. **Error States**: Any visible errors or broken features?

Be specific about what works vs what doesn't.`,

    'technical': `You are a web developer debugging a production application.

CONTEXT: This is the "${pageName}" page of "Vibe-Check" - analyzing the technical implementation.

TASK: Technical assessment:
1. **Loading State**: Did the page load completely or partially?
2. **Component Loading**: Are all expected components present?
3. **Default Content**: Is this showing default Angular content vs custom app content?
4. **Routing Issues**: Does this look like the correct page for the URL?
5. **JavaScript Errors**: Any signs of broken JavaScript or failed component loading?

Focus on what indicates technical problems vs working features.`,

    'comparison': `You are comparing this page against expected requirements.

CONTEXT: "${pageName}" page of "Vibe-Check" app.

EXPECTED for ${pageName}:
${getExpectedFeatures(pageName)}

TASK: Gap analysis:
1. **Present Features**: What expected features are actually there?
2. **Missing Features**: What's completely absent?
3. **Broken Features**: What's partially there but not working?
4. **Unexpected Content**: Anything that shouldn't be there?
5. **Overall Completeness**: How complete is this page (0-100%)?

Be specific about gaps between expected vs actual.`
  };
  
  const prompt = prompts[analysisType] + `

PAGE URL: ${pageData.url}

HTML CONTENT (first 3000 chars):
${pageData.content.substring(0, 3000)}`;

  try {
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: pageData.screenshot,
          mimeType: 'image/png'
        }
      }
    ]);
    
    return result.response.text();
    
  } catch (error) {
    console.error(`❌ Gemini API Error for ${analysisType}:`, error.message);
    return `Error: ${error.message}`;
  }
}

function getExpectedFeatures(pageName) {
  const expectations = {
    'Map (Default)': `
- Navigation bar with Vibe-Check branding and menu links
- "NYC Territory Map" heading
- Territory list showing 4 areas: Times Square, Central Park South, Lower East Side, Financial District
- Safety scores for each territory (like 6/10, 8/10, etc.)
- Territory descriptions
- "Refresh Data" and "Toggle View" buttons`,

    'Dashboard': `
- Navigation bar with menu links
- "Vibe-Check Dashboard" heading
- System Status card showing "Operational"
- AI Services card with Gemini AI and Vision API status
- Data Sources card with NYC Cameras and Firebase status
- Quick Stats card with territory count
- About section explaining the app`,

    'Analysis': `
- Navigation bar with menu links
- "Street Scene Analysis" heading with camera emoji
- File upload area with drag & drop functionality
- Upload icon (camera emoji)
- "Choose File" button
- Instructions for drag & drop or click to select`,

    'Reporting': `
- Navigation bar with menu links
- "Report Safety Issue" heading
- Location section with latitude/longitude inputs
- "Get Current Location" button
- Issue type dropdown with options
- Severity level radio buttons (Low/Medium/High)
- Description textarea
- "Submit Report" button`
  };
  
  return expectations[pageName] || 'No specific expectations defined';
}

async function runDetailedAnalysis() {
  console.log('🔍 Starting Detailed Vibe-Check Debug Analysis');
  console.log(`🌐 Target: ${APP_URL}`);
  
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const testPages = [
    { path: '/', name: 'Map (Default)' },
    { path: '/dashboard', name: 'Dashboard' },
    { path: '/analysis', name: 'Analysis' },
    { path: '/reporting', name: 'Reporting' }
  ];
  
  const analysisTypes = ['visual', 'functional', 'technical', 'comparison'];
  
  for (const pageConfig of testPages) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📄 ANALYZING: ${pageConfig.name.toUpperCase()}`);
    console.log(`${'='.repeat(60)}`);
    
    // Capture page data
    const pageData = await capturePageForAnalysis(browser, pageConfig.path, pageConfig.name);
    
    if (pageData.error) {
      console.log(`❌ Failed to capture page: ${pageData.error}`);
      continue;
    }
    
    // Run all analysis types
    for (const analysisType of analysisTypes) {
      console.log(`\n🔎 ${analysisType.toUpperCase()} ANALYSIS:`);
      console.log('-'.repeat(40));
      
      const analysis = await getDetailedAnalysis(pageData, pageConfig.name, analysisType);
      console.log(analysis);
    }
    
    // Console logs if any
    if (pageData.logs && pageData.logs.length > 0) {
      console.log(`\n🚨 CONSOLE LOGS:`);
      console.log('-'.repeat(40));
      pageData.logs.forEach(log => console.log(log));
    }
  }
  
  await browser.close();
  
  console.log(`\n${'='.repeat(60)}`);
  console.log('✅ DETAILED ANALYSIS COMPLETE');
  console.log(`${'='.repeat(60)}`);
}

// Run the detailed analysis
runDetailedAnalysis().catch(console.error); 