import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function readRootJson<T>(fileName: string): T {
  return JSON.parse(readFileSync(join(__dirname, '..', '..', '..', fileName), 'utf8')) as T;
}

describe('release configuration', () => {
  it('keeps Android package and versionCode configured', () => {
    const appConfig = readRootJson<{
      expo: {
        android?: {
          package?: string;
          versionCode?: number;
        };
      };
    }>('app.json');

    expect(appConfig.expo.android?.package).toBe('com.percy.rainproof');
    expect(appConfig.expo.android?.versionCode).toBeGreaterThanOrEqual(1);
  });

  it('keeps the EAS preview build as an installable APK', () => {
    const easConfig = readRootJson<{
      build?: {
        preview?: {
          distribution?: string;
          android?: {
            buildType?: string;
          };
        };
      };
    }>('eas.json');

    expect(easConfig.build?.preview?.distribution).toBe('internal');
    expect(easConfig.build?.preview?.android?.buildType).toBe('apk');
  });
});
