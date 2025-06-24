const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'your-api-key-here');

console.log('🤖 Gemini Auto-Tessellation Debugger Starting...');

class AutoTessellationDebugger {
    constructor() {
        this.model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro-latest' });
        this.debugSession = {
            iteration: 0,
            scores: [],
            feedback: [],
            improvements: []
        };
    }

    // Analyze tessellation data directly without screenshots
    async analyzeTessellationData() {
        console.log('🔍 Loading tessellation data for analysis...');
        
        try {
            // Load the tessellation results
            const zones = JSON.parse(fs.readFileSync('data/voronoi-tessellation-coastline.json', 'utf8'));
            const summary = JSON.parse(fs.readFileSync('data/voronoi-complete-summary.json', 'utf8'));
            
            console.log(`📊 Analyzing ${zones.length} zones from geography-first algorithm...`);
            
            // Create detailed analysis prompt
            const prompt = `You are a GIS expert analyzing a Voronoi tessellation of NYC camera zones. 

ANALYZE THIS TESSELLATION DATA AND PROVIDE DETAILED FEEDBACK:

**TESSELLATION SUMMARY:**
- Total zones: ${summary.total_zones}
- Bridge zones: ${summary.zone_breakdown?.bridge_zones || 0} (with exact bridge shapes)
- Land zones: ${summary.zone_breakdown?.land_zones || 0} (constrained to NYC landmass)
- Water-excluded zones: ${summary.zone_breakdown?.water_excluded_zones || 0}
- Coastline-bounded zones: ${summary.zone_breakdown?.coastline_bounded_zones || 0}
- Total coverage area: ${summary.coverage_analysis?.total_area_km2?.toFixed(2) || 'N/A'} km²
- Algorithm: ${summary.algorithm || 'geography_first_land_constrained_tessellation'}

**ZONE SAMPLE DATA:**
${JSON.stringify(zones.slice(0, 5).map(z => ({
    handle: z.handle,
    name: z.name,
    borough: z.borough,
    is_land_zone: z.is_land_zone,
    is_bridge_zone: z.is_bridge_zone,
    bounded_by_coastline: z.bounded_by_coastline,
    tessellation_method: z.tessellation_method,
    zone_area_sqm: z.zone_area_sqm,
    vertices_count: z.vertices_count
})), null, 2)}

**GEOGRAPHIC CONSTRAINTS ANALYSIS:**
- Coastline boundary points: ${summary.geographic_constraints?.coastline_boundary_points || 0}
- Hard boundary enforcement: ${summary.geographic_constraints?.hard_boundary_enforcement || false}
- Water exclusion active: ${summary.geographic_constraints?.water_exclusion_active || false}
- Bridge shape matching: ${summary.geographic_constraints?.bridge_shape_matching || false}

**QUALITY METRICS:**
- Bridge-shaped zones: ${summary.quality_metrics?.bridge_shaped_zones || 0}
- Land-constrained zones: ${summary.quality_metrics?.land_constrained_zones || 0}
- Geographic accuracy: ${summary.quality_metrics?.geographic_accuracy || 'unknown'}
- Zones extending over water: ${summary.coverage_analysis?.zones_extending_over_water || 0}

**YOUR ANALYSIS TASK:**
Evaluate how well this tessellation represents NYC's actual geography. Consider:

1. **Geographic Accuracy (1-100)**: How well do zones respect NYC boundaries?
2. **Water Exclusion (1-100)**: Are water areas properly excluded?
3. **Bridge Handling (1-100)**: Do bridge zones match actual bridge shapes?
4. **Coastline Precision (1-100)**: How accurately do zones follow NYC coastline?
5. **Overall Tessellation Quality (1-100)**: Complete geographic fidelity

**PROVIDE:**
1. **OVERALL ACCURACY SCORE** (1-100): Geographic accuracy assessment
2. **SPECIFIC ACHIEVEMENTS**: What the algorithm did well
3. **REMAINING ISSUES**: Any problems still to fix
4. **TECHNICAL IMPROVEMENTS**: Specific algorithm enhancements needed
5. **NEXT ITERATION PLAN**: How to achieve 95+ accuracy

Focus on geographic precision and real-world accuracy. This is a geography-first approach that should eliminate the major flaws of traditional Voronoi tessellation.`;

            console.log('🤖 Sending tessellation data to Gemini for analysis...');
            
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            return response.text();
            
        } catch (error) {
            console.error('❌ Error analyzing tessellation data:', error);
            return null;
        }
    }

    // Generate specific improvements based on analysis
    async generateTechnicalImprovements(analysisResult) {
        console.log('⚙️ Generating technical improvements...');
        
        const prompt = `Based on this tessellation analysis:

${analysisResult}

**GENERATE SPECIFIC TECHNICAL IMPROVEMENTS** for the geography-first tessellation algorithm:

**FOCUS AREAS:**
1. **Coastline Precision**: How to improve boundary accuracy
2. **Bridge Zone Optimization**: Better bridge shape matching
3. **Water Exclusion Enhancement**: More robust water area detection
4. **Zone Boundary Refinement**: Smoother, more accurate zone edges
5. **Coverage Optimization**: Better land area utilization

**PROVIDE ACTIONABLE CODE IMPROVEMENTS:**
1. **Algorithm Adjustments**: Specific parameter tuning
2. **Boundary Logic**: Enhanced coastline constraint handling
3. **Data Improvements**: Better geographic data sources needed
4. **Performance Optimizations**: Faster processing methods
5. **Quality Metrics**: How to measure improvement

**OUTPUT**: Specific JavaScript code modifications and algorithm improvements that will increase the accuracy score toward 95+.

Focus on PRACTICAL SOLUTIONS that can be immediately implemented.`;

        try {
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            return response.text();
        } catch (error) {
            console.error('❌ Error generating improvements:', error);
            return null;
        }
    }

    // Run complete automated debugging iteration
    async runAutomatedDebugging() {
        this.debugSession.iteration++;
        console.log(`\n🔄 AUTO-DEBUG ITERATION ${this.debugSession.iteration}`);
        console.log('==================================================');

        // Analyze tessellation data
        const analysis = await this.analyzeTessellationData();
        if (!analysis) {
            console.error('❌ Failed to analyze tessellation data');
            return;
        }

        console.log('\n📊 GEMINI ANALYSIS:');
        console.log(analysis);

        // Extract score from analysis
        const scoreMatch = analysis.match(/ACCURACY SCORE.*?(\d+)/i) || 
                          analysis.match(/OVERALL.*?(\d+)/i) ||
                          analysis.match(/(\d+)\/100/);
        const score = scoreMatch ? parseInt(scoreMatch[1]) : 0;
        
        this.debugSession.scores.push(score);
        this.debugSession.feedback.push(analysis);

        console.log(`\n🎯 DETECTED ACCURACY SCORE: ${score}/100`);

        // Evaluate performance
        if (score >= 95) {
            console.log('🎉 TESSELLATION ACHIEVED EXCELLENT ACCURACY!');
            console.log('✅ Geography-first approach successfully implemented!');
            return { complete: true, score };
        } else if (score >= 80) {
            console.log('✅ Good progress! Close to target accuracy.');
        } else if (score >= 60) {
            console.log('⚠️ Moderate accuracy achieved. More improvements needed.');
        } else {
            console.log('❌ Low accuracy. Significant improvements required.');
        }

        // Generate technical improvements
        const improvements = await this.generateTechnicalImprovements(analysis);

        // Save debugging results
        const debugResult = {
            iteration: this.debugSession.iteration,
            timestamp: new Date().toISOString(),
            accuracy_score: score,
            analysis: analysis,
            technical_improvements: improvements,
            session_scores: this.debugSession.scores,
            algorithm_type: 'geography_first_land_constrained',
            zones_analyzed: this.getZoneCount(),
            next_steps: score < 95 ? 'Apply improvements and re-run' : 'Ready for production'
        };

        fs.writeFileSync(
            `reports/auto-tessellation-debug-${this.debugSession.iteration}.json`, 
            JSON.stringify(debugResult, null, 2)
        );

        console.log('\n🔧 TECHNICAL IMPROVEMENTS NEEDED:');
        console.log(improvements);

        console.log(`\n💾 Auto-debug results saved to auto-tessellation-debug-${this.debugSession.iteration}.json`);

        return { 
            complete: false, 
            score, 
            analysis, 
            improvements,
            recommendation: this.getRecommendation(score)
        };
    }

    getZoneCount() {
        try {
            const zones = JSON.parse(fs.readFileSync('data/voronoi-tessellation-coastline.json', 'utf8'));
            return zones.length;
        } catch {
            return 0;
        }
    }

    getRecommendation(score) {
        if (score >= 95) return 'Ready for production deployment';
        if (score >= 85) return 'Apply final refinements for production readiness';
        if (score >= 70) return 'Focus on coastline precision and bridge optimization';
        if (score >= 50) return 'Major algorithm improvements needed';
        return 'Fundamental approach revision required';
    }

    // Analyze progress across iterations
    showProgress() {
        if (this.debugSession.scores.length === 0) return;

        console.log('\n📈 AUTO-DEBUGGING PROGRESS:');
        this.debugSession.scores.forEach((score, i) => {
            const trend = i > 0 ? (score > this.debugSession.scores[i-1] ? '📈' : '📉') : '📊';
            console.log(`Iteration ${i+1}: ${score}/100 ${trend}`);
        });

        const bestScore = Math.max(...this.debugSession.scores);
        const latestScore = this.debugSession.scores[this.debugSession.scores.length - 1];
        
        console.log(`\n🏆 Best Score: ${bestScore}/100`);
        console.log(`📊 Latest Score: ${latestScore}/100`);
        console.log(`🎯 Target: 95/100`);
        console.log(`📊 Total Iterations: ${this.debugSession.iteration}`);
    }
}

// Auto-run the debugger
async function main() {
    const analyzer = new AutoTessellationDebugger();
    
    console.log('🚀 Starting automated tessellation debugging...');
    console.log('📊 Analyzing geography-first tessellation results...');
    
    const result = await analyzer.runAutomatedDebugging();
    
    if (result) {
        analyzer.showProgress();
        
        console.log('\n🎯 DEBUGGING SUMMARY:');
        if (result.complete) {
            console.log('✅ PERFECT TESSELLATION ACHIEVED!');
            console.log('🚀 Ready for production deployment!');
        } else {
            console.log(`📊 Current accuracy: ${result.score}/100`);
            console.log(`🎯 Recommendation: ${result.recommendation}`);
            console.log('🔄 Apply suggested improvements and re-run generator');
        }
        
        console.log('\n🔄 TO APPLY IMPROVEMENTS:');
        console.log('1. Review the technical improvements above');
        console.log('2. Update the tessellation algorithm accordingly');
        console.log('3. Re-run: node scripts/generate-complete-voronoi-coastline.js');
        console.log('4. Re-run: node scripts/gemini-tessellation-auto-debugger.js');
        console.log('5. Repeat until 95+ accuracy achieved');
    }
}

// Export for use in other scripts
module.exports = { AutoTessellationDebugger };

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
} 