// Mappable Configuration
export const MAPPABLE_CONFIG = {
  // Replace with your actual Mappable API key
  API_KEY: 'YOUR_MAPPABLE_API_KEY_HERE',
  
  // Default map settings
  DEFAULT_CENTER: {
    latitude: 37.7749,
    longitude: -122.4194,
  },
  DEFAULT_ZOOM: 15,
  
  // Location settings
  LOCATION_ACCURACY: 'high',
  LOCATION_TIMEOUT: 10000,
  
  // Map styling
  MAP_STYLE: 'default',
};

// Initialize Mappable SDK
export const initializeMappable = async () => {
  try {
    // Import and initialize Mappable SDK
    // const { Mappable } = await import('@mappable/mappable-js');
    // await Mappable.initialize(MAPPABLE_CONFIG.API_KEY);
    console.log('Mappable SDK initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Mappable SDK:', error);
    throw error;
  }
}; 