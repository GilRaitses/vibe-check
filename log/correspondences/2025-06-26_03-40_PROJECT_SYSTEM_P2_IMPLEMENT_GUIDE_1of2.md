# 🚀 PHASE 2 IMPLEMENTATION GUIDE
## NYC Vibe-Check ML Service with Redis Integration

### IMMEDIATE DEPLOYMENT STEPS

#### 1. Deploy Cloud Run ML Service
```bash
cd cloud-run-ml
npm install
gcloud run deploy vibe-check-ml \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 1 \
  --max-instances 10 \
  --set-env-vars "REDIS_HOST=10.187.253.187,REDIS_PORT=6379" \
  --project vibe-check-463816
```

#### 2. Test Basic Functionality
```bash
# Health check
curl https://vibe-check-ml-vibe-check-463816.a.run.app/health

# Test camera processing
curl -X POST https://vibe-check-ml-vibe-check-463816.a.run.app/process/camera/83404149-7deb-43ee-81b5-66fe804c0feb \
  -H "Content-Type: application/json"
```

#### 3. Performance Testing Commands
```bash
# Load test with 100 concurrent requests
for i in {1..100}; do 
  curl -X POST https://vibe-check-ml-vibe-check-463816.a.run.app/process/camera/test-$i &
done

# Monitor response times
time curl https://vibe-check-ml-vibe-check-463816.a.run.app/health
```

### REDIS INTEGRATION STRATEGY

#### Cache Key Structure:
- `vision:camera:{camera_id}:frame:{hash}` - TTL: 5 minutes
- `prediction:camera:{camera_id}:horizon:{minutes}` - TTL: 30 minutes  
- `violation:camera:{camera_id}:type:{type}` - TTL: 24 hours

#### Performance Targets:
- **Response Time**: <500ms (with caching)
- **Cache Hit Rate**: >80%
- **Uptime SLA**: 99.9%

### ML PIPELINE TRIGGERS

#### Option 1: HTTP + Scheduler (Recommended)
- Real-time: HTTP POST `/process/camera/{id}`
- Batch: Cloud Scheduler every 5 minutes
- Bulk: HTTP POST `/predictions/bulk`

#### Option 2: Pub/Sub Integration
```bash
# Create topic
gcloud pubsub topics create vibe-check-processing

# Create subscription
gcloud pubsub subscriptions create ml-processing-sub \
  --topic=vibe-check-processing
```

### ALERT SYSTEM CONFIGURATION

#### Multi-Channel Alerts:
1. **High Confidence Violations (>0.8)**: Immediate webhook + email
2. **Medium Confidence (0.6-0.8)**: Webhook only
3. **System Alerts**: Performance degradation, Redis issues

#### Alert Endpoints:
```bash
# Configure webhook URL
export ALERT_WEBHOOK="https://api-4dwgqpvuta-uc.a.run.app/alerts/webhook"

# Test alert
curl -X POST $ALERT_WEBHOOK -H "Content-Type: application/json" -d '{
  "type": "VIOLATION_ALERT",
  "severity": "HIGH",
  "camera_id": "test-camera",
  "confidence": 0.89
}'
```

### PERFORMANCE MONITORING

#### Custom Metrics Setup:
```bash
# Enable Cloud Monitoring API
gcloud services enable monitoring.googleapis.com

# Create custom metrics
gcloud alpha monitoring metrics create "custom.googleapis.com/vibe_check/response_time" \
  --metric-kind=GAUGE \
  --value-type=DOUBLE
```

#### Monitoring Endpoints:
- `/health` - Service health
- `/metrics` - Performance metrics  
- `/status` - Redis connection status

### TESTING SCENARIOS

#### 1. Performance Test
```bash
# Test response time under load
ab -n 1000 -c 10 https://vibe-check-ml-vibe-check-463816.a.run.app/health
```

#### 2. Cache Effectiveness Test
```bash
# First request (cache miss)
time curl -X POST https://vibe-check-ml-vibe-check-463816.a.run.app/process/camera/test-cam

# Second request (cache hit)  
time curl -X POST https://vibe-check-ml-vibe-check-463816.a.run.app/process/camera/test-cam
```

#### 3. Redis Integration Test
```bash
# Connect to Redis directly
redis-cli -h 10.187.253.187 -p 6379 ping

# Check cache keys
redis-cli -h 10.187.253.187 -p 6379 keys "vision:*"
```

### PRODUCTION DEPLOYMENT CHECKLIST

- [ ] Cloud Run service deployed
- [ ] Redis connection verified
- [ ] BigQuery integration tested
- [ ] Alert system configured
- [ ] Performance monitoring active
- [ ] Cache hit rate >80%
- [ ] Response time <500ms
- [ ] Error rate <1%

### NEXT STEPS AFTER PHASE 2

1. **Scale Testing**: 1000+ concurrent requests
2. **ML Model Training**: Real ARIMA_PLUS models
3. **Advanced Alerts**: SMS, Slack integration
4. **Dashboard**: Real-time monitoring UI
5. **API Documentation**: Swagger/OpenAPI spec

### TROUBLESHOOTING

#### Common Issues:
1. **Redis Connection Failed**: Check VPC connector
2. **High Response Times**: Increase Cloud Run memory
3. **Cache Misses**: Verify Redis TTL settings
4. **BigQuery Errors**: Check service account permissions

#### Debug Commands:
```bash
# Check Cloud Run logs
gcloud logging tail "resource.type=cloud_run_revision"

# Monitor Redis
redis-cli -h 10.187.253.187 -p 6379 monitor

# BigQuery status
bq query "SELECT COUNT(*) FROM \`vibe-check-463816.vibecheck_analytics.realtime_violations\`"
```
