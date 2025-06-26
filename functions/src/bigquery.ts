import { BigQuery } from '@google-cloud/bigquery';

const bigquery = new BigQuery();

// Dataset and table IDs
const DATASET_ID = 'vibecheck_analytics';
const ANALYSIS_TABLE = 'zone_analyses';

/**
 * Ensure dataset and table exist. If not, create them with a minimal schema.
 */
async function ensureBigQueryResources() {
  // Ensure dataset exists
  const [datasets] = await bigquery.getDatasets();
  const datasetExists = datasets.some(d => d.id === DATASET_ID);
  if (!datasetExists) {
    await bigquery.createDataset(DATASET_ID, { location: 'US' });
    console.log(`📂 [BIGQUERY] Created dataset ${DATASET_ID}`);
  }

  const dataset = bigquery.dataset(DATASET_ID);
  const [tables] = await dataset.getTables();
  const tableExists = tables.some(t => t.id === ANALYSIS_TABLE);
  if (!tableExists) {
    // Basic schema – BigQuery is schemaless via JSON, but we define core cols
    const schema = [
      { name: 'camera_id', type: 'STRING' },
      { name: 'zone_id', type: 'STRING' },
      { name: 'camera_name', type: 'STRING' },
      { name: 'borough', type: 'STRING' },
      { name: 'latitude', type: 'FLOAT' },
      { name: 'longitude', type: 'FLOAT' },
      { name: 'temperature_score', type: 'FLOAT' },
      { name: 'analysis_json', type: 'STRING' },
      { name: 'timestamp', type: 'TIMESTAMP' }
    ];
    await dataset.createTable(ANALYSIS_TABLE, { schema });
    console.log(`📄 [BIGQUERY] Created table ${ANALYSIS_TABLE}`);
  }
}

/**
 * Insert a single analysis record into BigQuery's zone_analyses table.
 * The full analysis object is preserved in the analysis_json column for flexibility.
 */
export async function insertZoneAnalysis(record: any) {
  await ensureBigQueryResources();

  // Convert timestamp (may be Firestore Timestamp, Date or string) to ISO string
  let tsIso: string | null = null;
  if (record.timestamp) {
    if (typeof record.timestamp.toDate === 'function') {
      tsIso = record.timestamp.toDate().toISOString();
    } else if (record.timestamp instanceof Date) {
      tsIso = record.timestamp.toISOString();
    } else if (typeof record.timestamp === 'string') {
      tsIso = new Date(record.timestamp).toISOString();
    }
  }

  const row = {
    camera_id: record.camera_id,
    zone_id: record.zone_id,
    camera_name: record.camera_name,
    borough: record.borough,
    latitude: record.latitude,
    longitude: record.longitude,
    temperature_score: record.temperature_score,
    analysis_json: JSON.stringify(record),
    timestamp: tsIso ? tsIso : new Date().toISOString()
  };

  try {
    await bigquery.dataset(DATASET_ID).table(ANALYSIS_TABLE).insert(row);
    console.log(`✅ [BIGQUERY] Analysis for camera ${record.camera_id} inserted.`);
  } catch (error: any) {
    // If it's a duplicate or partial failure, log warning not error
    console.error(`❌ [BIGQUERY] Failed to insert analysis for ${record.camera_id}:`, error);
    throw error;
  }
} 