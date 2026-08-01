import * as path from 'path';
import { MapDataGenerator } from '/Volumes/SSD_DATA/AI Development OS/src/platform/spatial-verification-v3/generator/MapDataGenerator';

async function main() {
  const csvPath = '/Volumes/SSD_DATA/AI Development OS/projects/posting-map/data/MIE-03_FINAL_VERIFIED_AREAS.csv';
  const outputDir = '/Volumes/SSD_DATA/AI Development OS/projects/posting-map/validation/MIE-03_SPATIAL_VERIFICATION';
  const rootDir = '/Volumes/SSD_DATA/AI Development OS';

  const generator = new MapDataGenerator();
  await generator.generateAndVerify(csvPath, outputDir, rootDir);
}

main().catch(err => {
  console.error("Fatal Error during Spatial Verification:", err);
  process.exit(1);
});
