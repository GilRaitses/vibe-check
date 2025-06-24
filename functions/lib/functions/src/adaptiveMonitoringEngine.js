"use strict";
/**
 * Advanced Adaptive Monitoring Engine for Vibe-Check
 * Implements threshold-based scoring system with neighborhood initialization
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdaptiveMonitoringEngine = void 0;
class AdaptiveMonitoringEngine {
    // =====================================================
    // ADAPTIVE SCORING CALCULATIONS
    // =====================================================
    /**
     * Calculate adaptive monitoring score for a camera zone
     * @param numericalData 17-element array from vision analysis
     * @param cameraLocation Camera location and infrastructure data
     * @returns AdaptiveScore with sampling frequency
     */
    static calculateAdaptiveScore(numericalData, cameraLocation, neighborhoodBaseline = 24 // Default daily baseline
    ) {
        const riskFactors = [];
        let totalScore = neighborhoodBaseline; // Start with neighborhood baseline
        // Apply risk threshold matrix
        for (const threshold of this.RISK_THRESHOLDS) {
            const riskValue = this.extractRiskValue(threshold.condition, numericalData, cameraLocation);
            const triggered = riskValue >= threshold.scalar_threshold;
            const factor = {
                name: threshold.condition,
                value: riskValue,
                threshold: threshold.scalar_threshold,
                points_added: triggered ? threshold.score_points : 0,
                triggered
            };
            riskFactors.push(factor);
            if (triggered) {
                totalScore -= threshold.score_points; // Lower score = more frequent sampling
            }
        }
        // Infrastructure multiplier for specific high-risk combinations
        const infrastructureMultiplier = this.calculateInfrastructureMultiplier(numericalData, cameraLocation);
        if (infrastructureMultiplier > 1.0) {
            totalScore = totalScore / infrastructureMultiplier;
        }
        // Ensure score stays within bounds (minimum 0.5 hours, maximum 96 hours)
        totalScore = Math.max(0.5, Math.min(96, totalScore));
        return {
            total_score: totalScore,
            risk_factors: riskFactors,
            infrastructure_multiplier: infrastructureMultiplier,
            neighborhood_baseline: neighborhoodBaseline,
            sampling_frequency_hours: totalScore
        };
    }
    /**
     * Extract risk scalar value from numerical data based on condition
     */
    static extractRiskValue(condition, numericalData, cameraLocation) {
        // Map conditions to numerical data indices (based on our 17-variable system)
        switch (condition) {
            case 'pedestrian_street_grade_plus_bike_lane':
                // Combination of pedestrian walkway violations + bike lane presence
                return (numericalData[0] || 0) + (numericalData[1] || 0); // indices 0,1
            case 'bike_red_light_violation_active':
                return numericalData[2] || 0; // index 2
            case 'pedestrian_bike_interaction_critical':
                return numericalData[3] || 0; // index 3
            case 'sidewalk_obstruction_high':
                return numericalData[4] || 0; // index 4
            case 'dangerous_bike_lane_position':
                return numericalData[5] || 0; // index 5
            case 'traffic_congestion_pedestrian_impact':
                return (numericalData[6] || 0) + (numericalData[7] || 0); // indices 6,7
            case 'pedestrian_density_high':
                return numericalData[8] || 0; // index 8
            case 'bike_volume_moderate':
                return numericalData[9] || 0; // index 9
            case 'intersection_complexity':
                return numericalData[10] || 0; // index 10
            default:
                return 0;
        }
    }
    /**
     * Calculate infrastructure multiplier for high-risk combinations
     */
    static calculateInfrastructureMultiplier(numericalData, cameraLocation) {
        let multiplier = 1.0;
        // Gil's specific high-risk scenario: street-grade pedestrians + bike lanes
        const streetGradePedestrian = numericalData[0] || 0;
        const bikeLaneAdjacent = numericalData[1] || 0;
        if (streetGradePedestrian >= 1 && bikeLaneAdjacent >= 1) {
            multiplier *= 2.0; // Double the sampling frequency
        }
        // Multiple simultaneous violations
        const activeViolations = numericalData.slice(0, 6).filter(val => val > 0).length;
        if (activeViolations >= 3) {
            multiplier *= 1.5; // 50% more frequent
        }
        // Critical intersection complexity
        if ((numericalData[10] || 0) >= 3) {
            multiplier *= 1.3; // 30% more frequent
        }
        return multiplier;
    }
    // =====================================================
    // NEIGHBORHOOD INITIALIZATION SYSTEM
    // =====================================================
    /**
     * Initialize monitoring system with at least 1 camera per NYC neighborhood
     * This provides baseline stress distribution across Manhattan
     */
    static async initializeNeighborhoodBaselines(allCameras) {
        console.log('🗽 [ADAPTIVE] Initializing NYC neighborhood baseline cameras...');
        const baselineCameras = [];
        for (const neighborhood of this.NYC_NEIGHBORHOODS) {
            // Find cameras in this neighborhood
            const neighborhoodCameras = allCameras.filter(camera => {
                var _a, _b;
                return ((_a = camera.area) === null || _a === void 0 ? void 0 : _a.includes(neighborhood)) ||
                    ((_b = camera.name) === null || _b === void 0 ? void 0 : _b.includes(neighborhood)) ||
                    this.isInNeighborhood(camera, neighborhood);
            });
            if (neighborhoodCameras.length > 0) {
                // Select best baseline camera for this neighborhood
                const baselineCamera = this.selectOptimalBaselineCamera(neighborhoodCameras, neighborhood);
                const baselineScore = this.getNeighborhoodBaselineScore(neighborhood);
                baselineCameras.push({
                    neighborhood,
                    camera_id: baselineCamera.id,
                    camera: baselineCamera,
                    baseline_score: baselineScore,
                    is_baseline_camera: true
                });
                console.log(`📍 [${neighborhood}] Baseline camera: ${baselineCamera.name} (Score: ${baselineScore}h)`);
            }
            else {
                console.warn(`⚠️ [${neighborhood}] No cameras found for baseline`);
            }
        }
        console.log(`✅ [ADAPTIVE] Initialized ${baselineCameras.length} neighborhood baselines`);
        return baselineCameras;
    }
    /**
     * Get baseline sampling score for neighborhood
     */
    static getNeighborhoodBaselineScore(neighborhood) {
        // High-risk neighborhoods get more frequent baseline sampling
        const highRiskNeighborhoods = [
            'Hell\'s Kitchen', 'Times Square', 'Union Square', 'Chelsea'
        ];
        const mediumRiskNeighborhoods = [
            'Midtown West', 'Midtown East', 'Greenwich Village', 'SoHo'
        ];
        if (highRiskNeighborhoods.includes(neighborhood)) {
            return 12; // Every 12 hours baseline
        }
        else if (mediumRiskNeighborhoods.includes(neighborhood)) {
            return 18; // Every 18 hours baseline  
        }
        else {
            return 24; // Daily baseline
        }
    }
    /**
     * Select optimal camera for neighborhood baseline monitoring
     */
    static selectOptimalBaselineCamera(cameras, neighborhood) {
        // Prefer cameras with higher expected pedestrian-bike interaction
        return cameras.reduce((best, current) => {
            const currentScore = this.estimateCameraBaselineValue(current, neighborhood);
            const bestScore = this.estimateCameraBaselineValue(best, neighborhood);
            return currentScore > bestScore ? current : best;
        });
    }
    /**
     * Estimate camera's value as neighborhood baseline
     */
    static estimateCameraBaselineValue(camera, neighborhood) {
        var _a, _b, _c, _d, _e, _f, _g;
        let value = 0;
        // Prefer major intersections and avenues
        if (((_a = camera.name) === null || _a === void 0 ? void 0 : _a.includes('Ave')) || ((_b = camera.name) === null || _b === void 0 ? void 0 : _b.includes('Broadway')))
            value += 3;
        if ((_c = camera.name) === null || _c === void 0 ? void 0 : _c.includes('St'))
            value += 2;
        if (((_d = camera.name) === null || _d === void 0 ? void 0 : _d.includes('Square')) || ((_e = camera.name) === null || _e === void 0 ? void 0 : _e.includes('Plaza')))
            value += 4;
        // Check for high-traffic street segments
        for (const segment of this.HIGH_RISK_STREET_SEGMENTS) {
            if (segment.neighborhood === neighborhood &&
                (((_f = camera.name) === null || _f === void 0 ? void 0 : _f.includes(segment.streets.split(' ')[0])) ||
                    ((_g = camera.name) === null || _g === void 0 ? void 0 : _g.includes(segment.streets.split(' ')[1])))) {
                value += 5;
            }
        }
        return value;
    }
    /**
     * Check if camera is in specified neighborhood (basic heuristic)
     */
    static isInNeighborhood(camera, neighborhood) {
        // This would ideally use proper geocoding, but for now use coordinate heuristics
        const lat = camera.latitude;
        const lng = camera.longitude;
        // Rough neighborhood boundaries (would be more precise in production)
        const neighborhoodBounds = {
            'Hell\'s Kitchen': { lat_min: 40.75, lat_max: 40.77, lng_min: -73.99, lng_max: -73.98 },
            'Upper West Side': { lat_min: 40.78, lat_max: 40.80, lng_min: -73.97, lng_max: -73.95 },
            'Union Square': { lat_min: 40.73, lat_max: 40.74, lng_min: -73.99, lng_max: -73.98 },
            // Add more precise boundaries as needed
        };
        const bounds = neighborhoodBounds[neighborhood];
        if (!bounds)
            return false;
        return lat >= bounds.lat_min && lat <= bounds.lat_max &&
            lng >= bounds.lng_min && lng <= bounds.lng_max;
    }
    // =====================================================
    // FALLBACK ELIMINATION SYSTEM  
    // =====================================================
    /**
     * Eliminate fallbacks by ensuring robust real analysis
     */
    static async eliminateFallbacks(analysisAttempt) {
        const maxRetries = 3;
        const backoffDelays = [1000, 3000, 5000]; // ms
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                const result = await analysisAttempt();
                // Validate result quality
                if (this.isHighQualityAnalysis(result)) {
                    return result;
                }
                else {
                    console.warn(`⚠️ [ADAPTIVE] Low quality analysis on attempt ${attempt + 1}`);
                    if (attempt < maxRetries - 1) {
                        await this.delay(backoffDelays[attempt]);
                        continue;
                    }
                }
            }
            catch (error) {
                console.error(`❌ [ADAPTIVE] Analysis attempt ${attempt + 1} failed:`, error);
                if (attempt < maxRetries - 1) {
                    await this.delay(backoffDelays[attempt]);
                }
                else {
                    // Last resort: return structured error instead of generic fallback
                    return this.createStructuredErrorResult(error);
                }
            }
        }
        throw new Error('All analysis attempts failed');
    }
    /**
     * Validate analysis result quality
     */
    static isHighQualityAnalysis(result) {
        if (!result || !result.numerical_data)
            return false;
        // Check for non-zero data (indicates real analysis)
        const hasRealData = result.numerical_data.some((val) => val > 0);
        // Check for confidence scores
        const hasConfidence = result.analysis_confidence && result.analysis_confidence > 0.5;
        // Check for proper data source
        const hasValidSource = result.data_source &&
            result.data_source !== 'fallback_monitoring' &&
            result.data_source !== 'simulated';
        return hasRealData && hasConfidence && hasValidSource;
    }
    /**
     * Create structured error result instead of generic fallback
     */
    static createStructuredErrorResult(error) {
        return {
            success: false,
            error_type: 'analysis_failure',
            error_message: error instanceof Error ? error.message : String(error),
            retry_recommended: true,
            fallback_used: false,
            data_source: 'structured_error',
            timestamp: new Date().toISOString()
        };
    }
    static delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
exports.AdaptiveMonitoringEngine = AdaptiveMonitoringEngine;
// =====================================================
// RISK THRESHOLD MATRIX (Gil's Specification)
// =====================================================
AdaptiveMonitoringEngine.RISK_THRESHOLDS = [
    // Critical Infrastructure Combinations
    {
        condition: 'pedestrian_street_grade_plus_bike_lane',
        scalar_threshold: 1.0, // Any presence
        score_points: 24, // Hourly sampling
        description: 'Street-grade pedestrian path adjacent to bike lane (42nd-52nd 8th Ave, 42nd-57th 9th/10th Ave)'
    },
    {
        condition: 'bike_red_light_violation_active',
        scalar_threshold: 1.0, // Zero tolerance
        score_points: 48, // 30-minute sampling
        description: 'Active bike red light violations detected'
    },
    {
        condition: 'pedestrian_bike_interaction_critical',
        scalar_threshold: 3.0, // High interaction score
        score_points: 12, // 2-hour sampling  
        description: 'Critical pedestrian-bike interaction zones'
    },
    // Infrastructure Risk Factors
    {
        condition: 'sidewalk_obstruction_high',
        scalar_threshold: 2.5,
        score_points: 8, // 3-hour sampling
        description: 'High sidewalk obstruction forcing street walking'
    },
    {
        condition: 'dangerous_bike_lane_position',
        scalar_threshold: 2.0,
        score_points: 6, // 4-hour sampling
        description: 'Bikes in dangerous positions relative to pedestrians'
    },
    {
        condition: 'traffic_congestion_pedestrian_impact',
        scalar_threshold: 3.0,
        score_points: 4, // 6-hour sampling
        description: 'Traffic congestion affecting pedestrian safety'
    },
    // Density & Volume Factors
    {
        condition: 'pedestrian_density_high',
        scalar_threshold: 4.0,
        score_points: 3, // 8-hour sampling
        description: 'High pedestrian density areas'
    },
    {
        condition: 'bike_volume_moderate',
        scalar_threshold: 2.0,
        score_points: 2, // 12-hour sampling
        description: 'Moderate bike traffic volume'
    },
    {
        condition: 'intersection_complexity',
        scalar_threshold: 2.5,
        score_points: 3, // 8-hour sampling
        description: 'Complex multi-lane intersections'
    }
];
// =====================================================
// NYC NEIGHBORHOOD BASELINE SYSTEM
// =====================================================
AdaptiveMonitoringEngine.NYC_NEIGHBORHOODS = [
    'Hell\'s Kitchen', 'Midtown West', 'Midtown East', 'Times Square',
    'Chelsea', 'Flatiron', 'Union Square', 'Greenwich Village',
    'Lower East Side', 'SoHo', 'TriBeCa', 'Financial District',
    'Upper West Side', 'Upper East Side', 'Central Park Area',
    'Harlem', 'East Harlem', 'Washington Heights', 'Inwood'
];
AdaptiveMonitoringEngine.HIGH_RISK_STREET_SEGMENTS = [
    // Gil's specific examples
    { streets: '8th Ave (42nd-52nd St)', neighborhood: 'Hell\'s Kitchen', base_score: 24 },
    { streets: '9th Ave (42nd-57th St)', neighborhood: 'Hell\'s Kitchen', base_score: 24 },
    { streets: '10th Ave (42nd-57th St)', neighborhood: 'Hell\'s Kitchen', base_score: 24 },
    // Additional high-risk zones
    { streets: 'Amsterdam Ave (96th St area)', neighborhood: 'Upper West Side', base_score: 16 },
    { streets: '14th St (Union Square)', neighborhood: 'Union Square', base_score: 20 },
    { streets: '23rd St (Chelsea)', neighborhood: 'Chelsea', base_score: 12 },
    { streets: 'Houston St (SoHo)', neighborhood: 'SoHo', base_score: 14 },
    { streets: '125th St (Harlem)', neighborhood: 'Harlem', base_score: 10 }
];
//# sourceMappingURL=adaptiveMonitoringEngine.js.map