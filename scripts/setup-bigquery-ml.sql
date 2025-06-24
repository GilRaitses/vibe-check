-- =====================================================
-- BIGQUERY ML SETUP FOR VIBE-CHECK
-- Run these commands in BigQuery console: https://console.cloud.google.com/bigquery
-- =====================================================

-- Step 1: Create dataset for ML models
CREATE SCHEMA IF NOT EXISTS `vibe-check-463816.ml_models`
OPTIONS (
  description = "ML models and training data for safety violation prediction",
  location = "US"
);

-- Step 2: Create violations data table
CREATE OR REPLACE TABLE `vibe-check-463816.ml_models.violation_history` (
  timestamp TIMESTAMP,
  location STRING,
  
  -- 17 numerical features from your array
  pedestrian_walkway_violation FLOAT64,
  dangerous_bike_lane_position FLOAT64,
  bike_red_light_violation FLOAT64,
  blocking_pedestrian_flow FLOAT64,
  car_bike_lane_violation FLOAT64,
  pedestrian_density FLOAT64,
  vulnerable_population FLOAT64,
  traffic_volume FLOAT64,
  visibility_conditions FLOAT64,
  intersection_complexity FLOAT64,
  missing_barriers FLOAT64,
  poor_signage FLOAT64,
  signal_malfunction FLOAT64,
  cyclist_speed_estimate FLOAT64,
  aggressive_behavior FLOAT64,
  infrastructure_quality FLOAT64,
  weather_impact FLOAT64,
  overall_safety_risk FLOAT64,
  
  -- Additional context
  hour_of_day INT64,
  day_of_week INT64,
  is_weekend BOOL,
  weather_temp FLOAT64,
  weather_rain FLOAT64
);

-- Step 3: Create time series forecasting model
CREATE OR REPLACE MODEL `vibe-check-463816.ml_models.violation_forecaster`
OPTIONS (
  model_type = 'ARIMA_PLUS',
  time_series_timestamp_col = 'timestamp',
  time_series_data_col = 'bike_red_light_violation', -- Focus on bike violations first
  time_series_id_col = 'location',
  horizon = 6,  -- Predict 6 hours ahead
  auto_arima = TRUE,
  data_frequency = 'HOURLY'
) AS 
SELECT 
  timestamp,
  location,
  bike_red_light_violation
FROM `vibe-check-463816.ml_models.violation_history`
WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY);

-- Step 4: Create classification model for violation types
CREATE OR REPLACE MODEL `vibe-check-463816.ml_models.violation_classifier`
OPTIONS (
  model_type = 'LOGISTIC_REG',
  input_label_cols = ['violation_severity'],
  max_iterations = 50
) AS
SELECT 
  pedestrian_walkway_violation,
  dangerous_bike_lane_position,
  bike_red_light_violation,
  blocking_pedestrian_flow,
  car_bike_lane_violation,
  pedestrian_density,
  vulnerable_population,
  traffic_volume,
  visibility_conditions,
  intersection_complexity,
  missing_barriers,
  poor_signage,
  signal_malfunction,
  cyclist_speed_estimate,
  aggressive_behavior,
  infrastructure_quality,
  weather_impact,
  hour_of_day,
  day_of_week,
  
  -- Create severity labels from your data
  CASE 
    WHEN bike_red_light_violation >= 4 THEN 'critical'
    WHEN bike_red_light_violation >= 3 THEN 'high'
    WHEN bike_red_light_violation >= 2 THEN 'medium'
    ELSE 'low'
  END AS violation_severity
  
FROM `vibe-check-463816.ml_models.violation_history`
WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY);

-- =====================================================
-- PREDICTION QUERIES (Use these in your Cloud Functions)
-- =====================================================

-- Predict bike violations for next 6 hours
CREATE OR REPLACE VIEW `vibe-check-463816.ml_models.next_6_hours_forecast` AS
SELECT 
  forecast_timestamp,
  forecast_value as predicted_bike_violations,
  location,
  prediction_interval_lower_bound,
  prediction_interval_upper_bound,
  confidence_level
FROM ML.FORECAST(
  MODEL `vibe-check-463816.ml_models.violation_forecaster`,
  STRUCT(6 as horizon)  -- 6 hours ahead
);

-- Classify current violation severity
CREATE OR REPLACE VIEW `vibe-check-463816.ml_models.current_severity_prediction` AS
SELECT 
  predicted_violation_severity,
  predicted_violation_severity_probs,
  *
FROM ML.PREDICT(
  MODEL `vibe-check-463816.ml_models.violation_classifier`,
  (
    -- Replace these with actual values from your numerical array
    SELECT 
      2.0 as pedestrian_walkway_violation,  -- Example values
      3.0 as dangerous_bike_lane_position,
      4.0 as bike_red_light_violation,
      1.0 as blocking_pedestrian_flow,
      0.0 as car_bike_lane_violation,
      3.0 as pedestrian_density,
      2.0 as vulnerable_population,
      2.0 as traffic_volume,
      1.0 as visibility_conditions,
      2.0 as intersection_complexity,
      1.0 as missing_barriers,
      0.0 as poor_signage,
      0.0 as signal_malfunction,
      2.0 as cyclist_speed_estimate,
      1.0 as aggressive_behavior,
      2.0 as infrastructure_quality,
      1.0 as weather_impact,
      EXTRACT(HOUR FROM CURRENT_TIMESTAMP()) as hour_of_day,
      EXTRACT(DAYOFWEEK FROM CURRENT_TIMESTAMP()) as day_of_week
  )
);

-- =====================================================
-- DATA INSERTION HELPERS
-- =====================================================

-- Function to insert new violation data (call from Firebase Functions)
CREATE OR REPLACE PROCEDURE `vibe-check-463816.ml_models.insert_violation_data`(
  IN location_param STRING,
  IN numerical_array ARRAY<FLOAT64>,
  IN timestamp_param TIMESTAMP
)
BEGIN
  INSERT INTO `vibe-check-463816.ml_models.violation_history` (
    timestamp, location,
    pedestrian_walkway_violation, dangerous_bike_lane_position, bike_red_light_violation,
    blocking_pedestrian_flow, car_bike_lane_violation, pedestrian_density,
    vulnerable_population, traffic_volume, visibility_conditions, intersection_complexity,
    missing_barriers, poor_signage, signal_malfunction, cyclist_speed_estimate,
    aggressive_behavior, infrastructure_quality, weather_impact, overall_safety_risk,
    hour_of_day, day_of_week, is_weekend
  ) VALUES (
    timestamp_param, location_param,
    numerical_array[OFFSET(0)], numerical_array[OFFSET(1)], numerical_array[OFFSET(2)],
    numerical_array[OFFSET(3)], numerical_array[OFFSET(4)], numerical_array[OFFSET(5)],
    numerical_array[OFFSET(6)], numerical_array[OFFSET(7)], numerical_array[OFFSET(8)],
    numerical_array[OFFSET(9)], numerical_array[OFFSET(10)], numerical_array[OFFSET(11)],
    numerical_array[OFFSET(12)], numerical_array[OFFSET(13)], numerical_array[OFFSET(14)],
    numerical_array[OFFSET(15)], numerical_array[OFFSET(16)], numerical_array[OFFSET(16)],
    EXTRACT(HOUR FROM timestamp_param),
    EXTRACT(DAYOFWEEK FROM timestamp_param),
    EXTRACT(DAYOFWEEK FROM timestamp_param) IN (1, 7)  -- Sunday = 1, Saturday = 7
  );
END;

-- Auto-retrain models daily
CREATE OR REPLACE PROCEDURE `vibe-check-463816.ml_models.retrain_models`()
BEGIN
  -- Retrain forecaster with latest 30 days of data
  CREATE OR REPLACE MODEL `vibe-check-463816.ml_models.violation_forecaster`
  OPTIONS (
    model_type = 'ARIMA_PLUS',
    time_series_timestamp_col = 'timestamp',
    time_series_data_col = 'bike_red_light_violation',
    time_series_id_col = 'location',
    horizon = 6,
    auto_arima = TRUE,
    data_frequency = 'HOURLY'
  ) AS 
  SELECT 
    timestamp,
    location,
    bike_red_light_violation
  FROM `vibe-check-463816.ml_models.violation_history`
  WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY);
  
  -- Retrain classifier with latest data
  CREATE OR REPLACE MODEL `vibe-check-463816.ml_models.violation_classifier`
  OPTIONS (
    model_type = 'LOGISTIC_REG',
    input_label_cols = ['violation_severity'],
    max_iterations = 50
  ) AS
  SELECT 
    pedestrian_walkway_violation, dangerous_bike_lane_position, bike_red_light_violation,
    blocking_pedestrian_flow, car_bike_lane_violation, pedestrian_density,
    vulnerable_population, traffic_volume, visibility_conditions, intersection_complexity,
    missing_barriers, poor_signage, signal_malfunction, cyclist_speed_estimate,
    aggressive_behavior, infrastructure_quality, weather_impact,
    hour_of_day, day_of_week,
    CASE 
      WHEN bike_red_light_violation >= 4 THEN 'critical'
      WHEN bike_red_light_violation >= 3 THEN 'high'
      WHEN bike_red_light_violation >= 2 THEN 'medium'
      ELSE 'low'
    END AS violation_severity
  FROM `vibe-check-463816.ml_models.violation_history`
  WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY);
END; 