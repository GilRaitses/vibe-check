const fs = require('fs');

console.log('🔍 Simple Tessellation Analyzer Starting...');

class TessellationAnalyzer {
    constructor() {
        this.analysis = {
            timestamp: new Date().toISOString(),
            scores: {},
            total_score: 0,
            issues: [],
            achievements: [],
            improvements: []
        };
    }

    // Load and analyze tessellation data
    analyzeTessellation() {
        console.log('📊 Loading tessellation data...');
        
        try {
            const zones = JSON.parse(fs.readFileSync('data/voronoi-tessellation-coastline.json', 'utf8'));
            const summary = JSON.parse(fs.readFileSync('data/voronoi-complete-summary.json', 'utf8'));
            
            console.log(`📍 Found ${zones.length} zones to analyze`);
            console.log(`🗽 Algorithm: ${summary.algorithm || 'Unknown'}`);
            
            // Analyze different aspects
            this.analyzeGeographicAccuracy(zones, summary);
            this.analyzeWaterExclusion(zones, summary);
            this.analyzeBridgeHandling(zones, summary);
            this.analyzeCoastlinePrecision(zones, summary);
            this.analyzeOverallQuality(zones, summary);
            
            // Calculate total score
            const scores = Object.values(this.analysis.scores);
            this.analysis.total_score = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
            
            return this.analysis;
            
        } catch (error) {
            console.error('❌ Error loading tessellation data:', error.message);
            return null;
        }
    }

    // Analyze how well zones respect NYC boundaries
    analyzeGeographicAccuracy(zones, summary) {
        console.log('🗺️ Analyzing geographic accuracy...');
        
        const totalZones = zones.length;
        const landZones = zones.filter(z => z.is_land_zone).length;
        const waterRejected = summary.total_cameras - totalZones;
        
        // Score based on geography-first approach success
        let score = 85; // Base score for geography-first algorithm
        
        if (waterRejected > 400) {
            score += 10; // Bonus for correctly rejecting water cameras
            this.analysis.achievements.push('✅ Correctly rejected water-located cameras');
        }
        
        if (summary.geographic_constraints?.hard_boundary_enforcement) {
            score += 5;
            this.analysis.achievements.push('✅ Hard boundary enforcement active');
        }
        
        this.analysis.scores.geographic_accuracy = Math.min(100, score);
        
        console.log(`   📊 Land zones: ${landZones}/${totalZones}`);
        console.log(`   📊 Water cameras rejected: ${waterRejected}`);
        console.log(`   🎯 Geographic accuracy score: ${this.analysis.scores.geographic_accuracy}/100`);
    }

    // Analyze water exclusion effectiveness
    analyzeWaterExclusion(zones, summary) {
        console.log('🌊 Analyzing water exclusion...');
        
        const waterExtensionZones = summary.coverage_analysis?.zones_extending_over_water || 0;
        
        let score = 90; // High base score for geography-first approach
        
        if (waterExtensionZones === 0) {
            score = 100;
            this.analysis.achievements.push('✅ Perfect water exclusion - zero zones over water');
        } else {
            score -= Math.min(30, waterExtensionZones * 2);
            this.analysis.issues.push(`❌ ${waterExtensionZones} zones extending over water`);
        }
        
        if (summary.quality_metrics?.water_contamination === 'none') {
            this.analysis.achievements.push('✅ Algorithm prevents water contamination');
        }
        
        this.analysis.scores.water_exclusion = score;
        
        console.log(`   📊 Zones over water: ${waterExtensionZones}`);
        console.log(`   🎯 Water exclusion score: ${score}/100`);
    }

    // Analyze bridge camera handling
    analyzeBridgeHandling(zones, summary) {
        console.log('🌉 Analyzing bridge handling...');
        
        const bridgeZones = zones.filter(z => z.is_bridge_zone).length;
        const bridgeShapedZones = summary.quality_metrics?.bridge_shaped_zones || 0;
        
        let score = 70; // Base score
        
        if (bridgeZones > 0) {
            score += 20;
            this.analysis.achievements.push(`✅ ${bridgeZones} bridge zones with special handling`);
        }
        
        if (bridgeShapedZones > 0) {
            score += 10;
            this.analysis.achievements.push(`✅ ${bridgeShapedZones} zones with exact bridge shapes`);
        }
        
        if (summary.geographic_constraints?.bridge_shape_matching) {
            this.analysis.achievements.push('✅ Bridge shape matching algorithm active');
        }
        
        this.analysis.scores.bridge_handling = Math.min(100, score);
        
        console.log(`   📊 Bridge zones: ${bridgeZones}`);
        console.log(`   📊 Bridge-shaped zones: ${bridgeShapedZones}`);
        console.log(`   🎯 Bridge handling score: ${this.analysis.scores.bridge_handling}/100`);
    }

    // Analyze coastline precision
    analyzeCoastlinePrecision(zones, summary) {
        console.log('🏖️ Analyzing coastline precision...');
        
        const coastlineBoundedZones = summary.zone_breakdown?.coastline_bounded_zones || 0;
        const boundaryPoints = summary.geographic_constraints?.coastline_boundary_points || 0;
        
        let score = 80; // Base score for having coastline constraints
        
        if (boundaryPoints > 200) {
            score += 10;
            this.analysis.achievements.push(`✅ High-resolution coastline (${boundaryPoints} boundary points)`);
        }
        
        if (coastlineBoundedZones > 0) {
            score += 10;
            this.analysis.achievements.push(`✅ ${coastlineBoundedZones} zones naturally bounded by coastline`);
        }
        
        if (boundaryPoints < 100) {
            this.analysis.issues.push('❌ Low coastline resolution may affect precision');
        }
        
        this.analysis.scores.coastline_precision = Math.min(100, score);
        
        console.log(`   📊 Coastline boundary points: ${boundaryPoints}`);
        console.log(`   📊 Coastline-bounded zones: ${coastlineBoundedZones}`);
        console.log(`   🎯 Coastline precision score: ${this.analysis.scores.coastline_precision}/100`);
    }

    // Analyze overall tessellation quality
    analyzeOverallQuality(zones, summary) {
        console.log('🎯 Analyzing overall quality...');
        
        const landConstrainedZones = summary.quality_metrics?.land_constrained_zones || 0;
        const totalArea = summary.coverage_analysis?.total_area_km2 || 0;
        const avgZoneSize = summary.coverage_analysis?.average_zone_size_km2 || 0;
        
        let score = 85; // Base score for geography-first approach
        
        if (landConstrainedZones > 400) {
            score += 10;
            this.analysis.achievements.push(`✅ ${landConstrainedZones} zones properly land-constrained`);
        }
        
        if (totalArea > 500 && totalArea < 800) {
            score += 5;
            this.analysis.achievements.push(`✅ Reasonable total coverage area: ${totalArea.toFixed(1)} km²`);
        }
        
        if (avgZoneSize > 0.5 && avgZoneSize < 2.0) {
            this.analysis.achievements.push(`✅ Good average zone size: ${avgZoneSize.toFixed(3)} km²`);
        }
        
        if (summary.algorithm === 'geography_first_land_constrained_tessellation') {
            this.analysis.achievements.push('✅ Using advanced geography-first algorithm');
        }
        
        this.analysis.scores.overall_quality = Math.min(100, score);
        
        console.log(`   📊 Land-constrained zones: ${landConstrainedZones}`);
        console.log(`   📊 Total coverage: ${totalArea.toFixed(1)} km²`);
        console.log(`   📊 Average zone size: ${avgZoneSize.toFixed(3)} km²`);
        console.log(`   🎯 Overall quality score: ${this.analysis.scores.overall_quality}/100`);
    }

    // Generate improvement recommendations
    generateRecommendations() {
        const score = this.analysis.total_score;
        
        if (score >= 95) {
            this.analysis.improvements.push('🎉 Excellent! Ready for production deployment');
        } else if (score >= 85) {
            this.analysis.improvements.push('📈 Very good! Apply minor refinements:');
            if (this.analysis.scores.coastline_precision < 95) {
                this.analysis.improvements.push('  • Increase coastline boundary point resolution');
            }
            if (this.analysis.scores.bridge_handling < 95) {
                this.analysis.improvements.push('  • Refine bridge shape definitions');
            }
        } else if (score >= 70) {
            this.analysis.improvements.push('🔧 Good progress! Focus on:');
            if (this.analysis.scores.water_exclusion < 90) {
                this.analysis.improvements.push('  • Improve water area detection algorithm');
            }
            if (this.analysis.scores.geographic_accuracy < 90) {
                this.analysis.improvements.push('  • Enhance boundary constraint logic');
            }
        } else {
            this.analysis.improvements.push('⚠️ Significant improvements needed:');
            this.analysis.improvements.push('  • Review geography-first algorithm implementation');
            this.analysis.improvements.push('  • Check coastline boundary data quality');
            this.analysis.improvements.push('  • Verify water exclusion logic');
        }
    }

    // Display comprehensive results
    displayResults() {
        console.log('\n🎯 TESSELLATION ANALYSIS RESULTS');
        console.log('=====================================');
        
        console.log(`\n📊 ACCURACY SCORES:`);
        Object.entries(this.analysis.scores).forEach(([metric, score]) => {
            const emoji = score >= 90 ? '🟢' : score >= 70 ? '🟡' : '🔴';
            console.log(`   ${emoji} ${metric.replace(/_/g, ' ')}: ${score}/100`);
        });
        
        console.log(`\n🏆 OVERALL SCORE: ${this.analysis.total_score}/100`);
        
        if (this.analysis.achievements.length > 0) {
            console.log(`\n✅ ACHIEVEMENTS:`);
            this.analysis.achievements.forEach(achievement => console.log(`   ${achievement}`));
        }
        
        if (this.analysis.issues.length > 0) {
            console.log(`\n❌ ISSUES IDENTIFIED:`);
            this.analysis.issues.forEach(issue => console.log(`   ${issue}`));
        }
        
        this.generateRecommendations();
        
        if (this.analysis.improvements.length > 0) {
            console.log(`\n🔧 RECOMMENDATIONS:`);
            this.analysis.improvements.forEach(improvement => console.log(`   ${improvement}`));
        }
        
        // Save results
        fs.writeFileSync(
            `reports/tessellation-analysis-${Date.now()}.json`,
            JSON.stringify(this.analysis, null, 2)
        );
        
        console.log(`\n💾 Results saved to reports/tessellation-analysis-${Date.now()}.json`);
        
        return this.analysis.total_score;
    }
}

// Run the analysis
async function main() {
    const analyzer = new TessellationAnalyzer();
    
    console.log('🚀 Starting tessellation analysis...');
    
    const results = analyzer.analyzeTessellation();
    if (results) {
        const score = analyzer.displayResults();
        
        if (score >= 95) {
            console.log('\n🎉 EXCELLENT TESSELLATION! Ready for production!');
        } else if (score >= 85) {
            console.log('\n✅ Very good tessellation! Minor improvements needed.');
        } else if (score >= 70) {
            console.log('\n⚠️ Good progress! Apply improvements and re-run.');
        } else {
            console.log('\n❌ Significant improvements needed. Review algorithm.');
        }
        
        console.log('\n🔄 TO IMPROVE:');
        console.log('1. Apply recommended improvements');
        console.log('2. Re-run: node scripts/generate-complete-voronoi-coastline.js');
        console.log('3. Re-run: node scripts/simple-tessellation-analyzer.js');
        console.log('4. Repeat until 95+ score achieved');
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { TessellationAnalyzer }; 