const fs = require('fs');
const { GoogleGenerativeAI } = require('@google/generative-ai');

console.log('🔬 COMPREHENSIVE TESSELLATION ANALYZER');
console.log('🎯 Evaluating Advanced Geographic Tessellation Quality');

// Load tessellation results
const zones = JSON.parse(fs.readFileSync('data/voronoi-tessellation-coastline.json', 'utf8'));
const summary = JSON.parse(fs.readFileSync('data/voronoi-complete-summary.json', 'utf8'));

console.log(`📊 Analyzing ${zones.length} zones...`);

// Detailed Analysis
const bridgeZones = zones.filter(z => z.is_bridge_zone);
const landZones = zones.filter(z => z.is_land_zone);
const constrainedZones = zones.filter(z => z.bounded_by_coastline);
const boroughBreakdown = {};

zones.forEach(zone => {
    const borough = zone.borough || 'Unknown';
    if (!boroughBreakdown[borough]) {
        boroughBreakdown[borough] = { total: 0, constrained: 0, bridge: 0 };
    }
    boroughBreakdown[borough].total++;
    if (zone.bounded_by_coastline) boroughBreakdown[borough].constrained++;
    if (zone.is_bridge_zone) boroughBreakdown[borough].bridge++;
});

// Calculate quality metrics
const averageVertices = zones.reduce((sum, z) => sum + z.vertices_count, 0) / zones.length;
const averageArea = zones.reduce((sum, z) => sum + z.zone_area_sqm, 0) / zones.length;
const smallZones = zones.filter(z => z.zone_area_sqm < 100000).length; // < 0.1 km²
const largeZones = zones.filter(z => z.zone_area_sqm > 10000000).length; // > 10 km²

// Geographic coverage analysis
const latRange = {
    min: Math.min(...zones.map(z => z.coordinates[0])),
    max: Math.max(...zones.map(z => z.coordinates[0]))
};
const lngRange = {
    min: Math.min(...zones.map(z => z.coordinates[1])),
    max: Math.max(...zones.map(z => z.coordinates[1]))
};

console.log('\n📊 DETAILED ANALYSIS RESULTS:');
console.log(`✅ Total zones: ${zones.length}`);
console.log(`🌉 Bridge zones with real geometry: ${bridgeZones.length}`);
console.log(`🏝️ Land zones: ${landZones.length}`);
console.log(`🏖️ Geographically constrained zones: ${constrainedZones.length} (${((constrainedZones.length/zones.length)*100).toFixed(1)}%)`);
console.log(`📐 Average vertices per zone: ${averageVertices.toFixed(1)}`);
console.log(`📏 Average zone area: ${(averageArea/1000000).toFixed(3)} km²`);
console.log(`🔍 Small zones (< 0.1 km²): ${smallZones}`);
console.log(`🔍 Large zones (> 10 km²): ${largeZones}`);
console.log(`🌍 Latitude range: ${latRange.min.toFixed(4)} to ${latRange.max.toFixed(4)}`);
console.log(`🌍 Longitude range: ${lngRange.min.toFixed(4)} to ${lngRange.max.toFixed(4)}`);

console.log('\n🏙️ BOROUGH BREAKDOWN:');
Object.entries(boroughBreakdown).forEach(([borough, stats]) => {
    const constrainedPercent = ((stats.constrained / stats.total) * 100).toFixed(1);
    console.log(`   ${borough}: ${stats.total} zones, ${stats.constrained} constrained (${constrainedPercent}%), ${stats.bridge} bridges`);
});

// Prepare comprehensive analysis for Gemini AI
const analysisData = {
    tessellation_summary: summary,
    zone_statistics: {
        total_zones: zones.length,
        bridge_zones: bridgeZones.length,
        land_zones: landZones.length,
        constrained_zones: constrainedZones.length,
        constraint_percentage: ((constrainedZones.length/zones.length)*100).toFixed(1)
    },
    geometric_quality: {
        average_vertices: averageVertices.toFixed(1),
        average_area_km2: (averageArea/1000000).toFixed(3),
        small_zones_count: smallZones,
        large_zones_count: largeZones,
        geographic_spread: {
            lat_range: `${latRange.min.toFixed(4)} to ${latRange.max.toFixed(4)}`,
            lng_range: `${lngRange.min.toFixed(4)} to ${lngRange.max.toFixed(4)}`
        }
    },
    borough_distribution: boroughBreakdown,
    sample_zones: zones.slice(0, 5).map(z => ({
        handle: z.handle,
        borough: z.borough,
        vertices: z.vertices_count,
        area_km2: (z.zone_area_sqm/1000000).toFixed(3),
        constrained: z.bounded_by_coastline,
        bridge: z.is_bridge_zone,
        coverage_quality: z.coverage_quality
    }))
};

console.log('\n🤖 Preparing Gemini AI Analysis...');

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI('AIzaSyCmQpywkSrG_YH-JwaMkuYQ0dSFYC4zy_c');
const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

async function runComprehensiveAnalysis() {
    const prompt = `
# ADVANCED TESSELLATION QUALITY ANALYSIS

You are analyzing an advanced NYC camera tessellation system that implements geographic boundary constraints using real NYC borough data. 

## TESSELLATION DATA:
${JSON.stringify(analysisData, null, 2)}

## ANALYSIS REQUIREMENTS:

**CURRENT PERFORMANCE ASSESSMENT (Score: 0-100):**
1. Geographic Accuracy - How well do zones respect real NYC boundaries?
2. Boundary Constraint Effectiveness - Are zones properly clipped to landmass?
3. Coverage Completeness - Are all cameras in NYC getting proper coverage?
4. Bridge Handling Quality - Are bridge zones using realistic geometry?
5. Borough Distribution Balance - Are all boroughs properly represented?

**SPECIFIC IMPROVEMENT RECOMMENDATIONS:**
1. **Critical Issues** - What are the most urgent problems to fix?
2. **Data Quality** - What additional geographic data sources are needed?
3. **Algorithm Enhancements** - What specific code improvements would increase accuracy?
4. **Coverage Gaps** - Are there missing areas or camera groups?
5. **Boundary Precision** - How can we improve coastline/borough boundary accuracy?

**PATH TO 100% ACCURACY:**
1. **Immediate Actions** (next 1-2 improvements to reach 85-90%)
2. **Medium-term Goals** (reach 90-95%)
3. **Advanced Optimizations** (reach 95-100%)

**TECHNICAL SPECIFICATIONS:**
- Provide specific GeoJSON data source recommendations
- Suggest exact algorithm modifications
- Identify specific camera groups needing special handling
- Recommend additional constraint types (water bodies, parks, etc.)

Focus on actionable, specific recommendations that can be immediately implemented to improve the tessellation quality from its current state to 100% geographic accuracy.
`;

    try {
        console.log('🧠 Running Gemini AI comprehensive analysis...');
        const result = await model.generateContent(prompt);
        const response = result.response;
        const analysis = response.text();

        // Save analysis results
        const fullReport = {
            generated_at: new Date().toISOString(),
            tessellation_data: analysisData,
            gemini_analysis: analysis,
            recommendations_status: "comprehensive_quality_analysis_complete"
        };

        fs.writeFileSync(`reports/comprehensive-tessellation-analysis-${Date.now()}.json`, 
            JSON.stringify(fullReport, null, 2));

        console.log('\n🎯 GEMINI AI COMPREHENSIVE ANALYSIS:');
        console.log('=' * 80);
        console.log(analysis);
        console.log('=' * 80);

        console.log('\n💾 Saved comprehensive analysis report');
        console.log('🚀 Ready for next optimization phase!');

    } catch (error) {
        console.error('❌ Gemini analysis error:', error.message);
        
        // Provide manual analysis if AI fails
        console.log('\n📊 MANUAL QUALITY ASSESSMENT:');
        console.log(`✅ Geographic Constraint Success: ${((constrainedZones.length/zones.length)*100).toFixed(1)}%`);
        console.log(`🎯 Current Accuracy Estimate: ${summary.coverage_percent > 30 ? '75-85' : '65-75'}/100`);
        console.log('\n🔧 IMMEDIATE IMPROVEMENTS NEEDED:');
        console.log('1. Include more camera locations (currently only 99/940)');
        console.log('2. Add water body exclusion data');
        console.log('3. Enhanced bridge polygon definitions');
        console.log('4. Park and restricted area boundaries');
        console.log('5. High-resolution coastline data');
    }
}

runComprehensiveAnalysis(); 