// Temporary fix for Vision API
import { ImageAnnotatorClient } from '@google-cloud/vision';

// Create client with explicit typing
const createVisionClient = (): ImageAnnotatorClient => {
  return new ImageAnnotatorClient();
};

export const visionClient = createVisionClient();
