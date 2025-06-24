const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'your-api-key-here');

console.log('🔍 Gemini-Powered Tessellation Debugger Starting...');

class TessellationDebugger {
    constructor() {
        this.model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro-latest' });
        this.debugSession = {
            iteration: 0,
            scores: [],
            feedback: [],
            improvements: []
        };
    }

    // Convert image file to base64 for Gemini
    fileToGenerativePart(path, mimeType) {
        return {
            inlineData: {
                data: Buffer.from(fs.readFileSync(path)).toString('base64'),
                mimeType
            }
        };
    }

    // Analyze tessellation screenshot with Gemini Vision
    async analyzeTessellation(screenshotPath) {
        console.log(`🤖 Analyzing tessellation screenshot: ${screenshotPath}`);
        
        const prompt = `You are a GIS expert analyzing a Voronoi tessellation of NYC camera zones. 

ANALYZE THIS TESSELLATION IMAGE AND PROVIDE DETAILED FEEDBACK:

**CURRENT TASK**: Evaluate how accurately this tessellation represents the actual shape and boundaries of New York City's 5 boroughs (Manhattan, Brooklyn, Queens, Bronx, Staten Island).

**WHAT YOU SHOULD SEE**: 
- Camera zones (colored polygons) should ONLY cover NYC landmass
- Water areas (Hudson River, East River, NY Harbor, Atlantic Ocean) should be BLACK/EMPTY
- Zone boundaries should follow NYC's actual coastline shape
- Bridges should have zones extending over them
- No zones should extend into New Jersey, Connecticut, or other non-NYC areas

**SCORING CRITERIA** (Rate 1-100):
1. **Coastline Accuracy**: Do zone boundaries follow actual NYC coastline?
2. **Water Exclusion**: Are water areas properly excluded (no zones over water)?
3. **Geographic Precision**: Do zones stay within NYC boundaries?
4. **Bridge Handling**: Are bridge areas properly included as land?
5. **Overall Shape**: Does the tessellation match NYC's actual island shape?

**PROVIDE**:
1. **ACCURACY SCORE** (1-100): Overall geographic accuracy
2. **SPECIFIC ISSUES**: What's wrong with the current tessellation?
3. **COASTLINE PROBLEMS**: Where are the boundary errors?
4. **IMPROVEMENT SUGGESTIONS**: Specific technical fixes needed
5. **NEXT ITERATION PLAN**: What to change in the algorithm

Be extremely detailed and technical in your analysis. Focus on geographic accuracy.`;

        try {
            const imagePart = this.fileToGenerativePart(screenshotPath, 'image/png');
            const result = await this.model.generateContent([prompt, imagePart]);
            const response = await result.response;
            return response.text();
        } catch (error) {
            console.error('Error analyzing with Gemini:', error);
            return null;
        }
    }

    // Generate improved coastline coordinates based on feedback
    async generateImprovedCoastline(analysisResult, currentCoastline) {
        console.log('🛠️ Generating improved coastline coordinates...');
        
        const prompt = `Based on this analysis of the NYC tessellation:

${analysisResult}

**CURRENT COASTLINE COORDINATES**: 
${JSON.stringify(currentCoastline.slice(0, 10), null, 2)}... (showing first 10 points)

**YOUR TASK**: Generate IMPROVED coastline boundary coordinates that will create a more accurate tessellation.

**REQUIREMENTS**:
1. Provide coordinates that PRECISELY follow NYC's actual coastline
2. Include detailed points for Manhattan, Brooklyn, Queens, Bronx, Staten Island
3. Ensure coordinates form a CLOSED POLYGON around only NYC landmass
4. Include bridge connection points where appropriate
5. Exclude areas that extend into NJ, CT, or other non-NYC regions

**OUTPUT FORMAT**:
\`\`\`javascript
const improvedCoastline = [
    // Manhattan West Side (Hudson River)
    [-74.0XXX, 40.7XXX], 
    // ... more coordinates
];
\`\`\`

Provide AT LEAST 300-400 coordinate points for high precision. Focus on areas identified as problematic in the analysis.`;

        try {
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            return response.text();
        } catch (error) {
            console.error('Error generating improved coastline:', error);
            return null;
        }
    }

    // Generate code improvements based on analysis
    async generateCodeImprovements(analysisResult) {
        console.log('⚙️ Generating code improvements...');
        
        const prompt = `Based on this tessellation analysis:

${analysisResult}

**GENERATE SPECIFIC CODE IMPROVEMENTS** for the Voronoi tessellation algorithm:

**CURRENT ISSUES TO FIX**:
1. Zones extending beyond NYC boundaries
2. Improper coastline constraint handling
3. Water area inclusion problems
4. Bridge area detection issues

**PROVIDE**:
1. **Boundary Constraint Logic**: How to better constrain zones to NYC landmass
2. **Water Exclusion Algorithm**: Code to prevent zones over water
3. **Coastline Integration**: How to use coastline points as hard boundaries
4. **Bridge Handling**: Logic for including bridge areas as valid land
5. **Point-in-polygon Improvements**: Better land/water detection

**OUTPUT**: Specific JavaScript code fixes and algorithm improvements that will solve the identified problems.

Focus on TECHNICAL SOLUTIONS that will improve geographic accuracy.`;

        try {
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            return response.text();
        } catch (error) {
            console.error('Error generating code improvements:', error);
            return null;
        }
    }

    // Run complete debugging iteration
    async debugIteration(screenshotPath) {
        this.debugSession.iteration++;
        console.log(`\n🔄 DEBUG ITERATION ${this.debugSession.iteration}`);
        console.log('==================================================');

        // Analyze current tessellation
        const analysis = await this.analyzeTessellation(screenshotPath);
        if (!analysis) {
            console.error('❌ Failed to analyze tessellation');
            return;
        }

        console.log('📊 GEMINI ANALYSIS:');
        console.log(analysis);

        // Extract score from analysis (simple regex, could be improved)
        const scoreMatch = analysis.match(/ACCURACY SCORE.*?(\d+)/i);
        const score = scoreMatch ? parseInt(scoreMatch[1]) : 0;
        
        this.debugSession.scores.push(score);
        this.debugSession.feedback.push(analysis);

        console.log(`\n🎯 ACCURACY SCORE: ${score}/100`);

        // If score is high enough, we're done
        if (score >= 95) {
            console.log('🎉 TESSELLATION ACHIEVED EXCELLENT ACCURACY!');
            return { complete: true, score };
        }

        // Generate improvements
        const currentCoastline = JSON.parse(fs.readFileSync('data/voronoi-complete-summary.json', 'utf8'));
        const improvedCoastline = await this.generateImprovedCoastline(analysis, []);
        const codeImprovements = await this.generateCodeImprovements(analysis);

        // Save debugging results
        const debugResult = {
            iteration: this.debugSession.iteration,
            timestamp: new Date().toISOString(),
            accuracy_score: score,
            analysis: analysis,
            improved_coastline: improvedCoastline,
            code_improvements: codeImprovements,
            session_scores: this.debugSession.scores
        };

        fs.writeFileSync(
            `reports/tessellation-debug-${this.debugSession.iteration}.json`, 
            JSON.stringify(debugResult, null, 2)
        );

        console.log('\n🔧 SUGGESTED IMPROVEMENTS:');
        console.log(codeImprovements);

        console.log(`\n💾 Debug results saved to tessellation-debug-${this.debugSession.iteration}.json`);

        return { 
            complete: false, 
            score, 
            analysis, 
            improvements: codeImprovements,
            coastline: improvedCoastline 
        };
    }

    // Compare multiple iterations
    analyzeProgress() {
        if (this.debugSession.scores.length < 2) return;

        console.log('\n📈 DEBUGGING PROGRESS:');
        this.debugSession.scores.forEach((score, i) => {
            const trend = i > 0 ? (score > this.debugSession.scores[i-1] ? '📈' : '📉') : '📊';
            console.log(`Iteration ${i+1}: ${score}/100 ${trend}`);
        });

        const bestScore = Math.max(...this.debugSession.scores);
        const latestScore = this.debugSession.scores[this.debugSession.scores.length - 1];
        
        console.log(`\n🏆 Best Score: ${bestScore}/100`);
        console.log(`📊 Latest Score: ${latestScore}/100`);
        console.log(`📊 Total Iterations: ${this.debugSession.iteration}`);
    }
}

// CLI interface
async function main() {
    const analyzer = new TessellationDebugger();
    
    // Check for screenshot argument
    const screenshotPath = process.argv[2];
    if (!screenshotPath) {
        console.log(`
🔍 GEMINI TESSELLATION DEBUGGER

USAGE:
  node scripts/gemini-tessellation-debugger.js <screenshot-path>

EXAMPLE:
  node scripts/gemini-tessellation-debugger.js screenshots/tessellation-current.png

WORKFLOW:
1. Take screenshot of current tessellation dashboard
2. Run this debugger with screenshot path
3. Get Gemini's visual analysis and improvement suggestions
4. Apply improvements to tessellation code
5. Repeat until perfect accuracy achieved

FEATURES:
- Visual analysis of tessellation accuracy
- Geographic boundary validation
- Coastline precision evaluation
- Technical improvement suggestions
- Progress tracking across iterations
        `);
        return;
    }

    if (!fs.existsSync(screenshotPath)) {
        console.error(`❌ Screenshot not found: ${screenshotPath}`);
        return;
    }

    // Run debugging iteration
    console.log('🚀 Starting Gemini-powered tessellation debugging...');
    const result = await analyzer.debugIteration(screenshotPath);
    
    if (result) {
        analyzer.analyzeProgress();
        
        if (result.complete) {
            console.log('\n🎯 PERFECT TESSELLATION ACHIEVED!');
        } else {
            console.log('\n🔄 Ready for next iteration. Apply improvements and re-run.');
        }
    }
}

// Auto-debugging mode for continuous improvement
async function autoBugMode() {
    console.log('🤖 AUTO-DEBUG MODE: Continuous tessellation improvement');
    const analyzer = new TessellationDebugger();
    
    // Watch for new screenshots and auto-analyze
    const screenshotDir = 'screenshots';
    if (!fs.existsSync(screenshotDir)) {
        fs.mkdirSync(screenshotDir);
    }
    
    console.log(`👀 Watching ${screenshotDir} for new tessellation screenshots...`);
    console.log('📸 Drop screenshots here for automatic analysis!');
    
    // Simple file watcher (could use chokidar for production)
    setInterval(async () => {
        const files = fs.readdirSync(screenshotDir)
            .filter(f => f.endsWith('.png') || f.endsWith('.jpg'))
            .map(f => ({
                name: f,
                path: path.join(screenshotDir, f),
                mtime: fs.statSync(path.join(screenshotDir, f)).mtime
            }))
            .sort((a, b) => b.mtime - a.mtime);
        
        if (files.length > 0) {
            const latest = files[0];
            console.log(`📸 Found new screenshot: ${latest.name}`);
            await analyzer.debugIteration(latest.path);
        }
    }, 5000); // Check every 5 seconds
}

// Export for use in other scripts
module.exports = { TessellationDebugger };

// Run if called directly
if (require.main === module) {
    if (process.argv.includes('--auto')) {
        autoBugMode();
    } else {
        main();
    }
} 