import { ProductConfiguration } from '../../../src/config/ProductConfiguration';
import { FeatureToggle } from '../../../src/config/FeatureToggle';
import { ProductRuntimeValidator } from '../../../src/dashboard/ProductRuntimeValidator';
import { DashboardApplication } from '../../../src/dashboard/DashboardApplication';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[Assertion Failure] ${message}`);
  }
}

// Browser context mocks
const globalVar = globalThis as any;
globalVar.window = globalVar;

Object.defineProperty(globalThis, 'navigator', {
  value: { onLine: true },
  writable: true,
  configurable: true
});

globalVar.document = {
  createElement(tag: string) {
    return {
      tagName: tag.toUpperCase(),
      style: {
        setProperty(name: string, value: string) {
          (this as any)[name] = value;
        }
      },
      appendChild(child: any) { return child; },
      addEventListener(event: string, cb: any) {},
      classList: {
        add() {},
        remove() {}
      },
      id: '',
      innerText: '',
      innerHTML: '',
      remove() {}
    } as any;
  },
  head: {
    appendChild(child: any) {}
  },
  body: {
    appendChild(child: any) {}
  },
  getElementById(id: string) {
    if (id === 'app') {
      return { id: 'app' } as any;
    }
    return null;
  }
} as any;

async function runTests() {
  console.log('[Test ProductRC] Starting Product Release Candidate tests...');

  // 1. ProductConfiguration Test
  {
    const configInstance = ProductConfiguration.getInstance();
    const config = configInstance.getConfig();
    assert(config.productName === 'POSTING MAP', 'Default product name mismatch');
    assert(config.productEdition === 'Standard', 'Default edition should be Standard');

    // CONFIG オーバーライドの検証
    (globalVar as any).POSTING_MAP_CONFIG = {
      PRODUCT_EDITION: 'Premium',
      PRODUCT_VERSION: '2.0.0-PRO'
    };
    const overriddenConfig = configInstance.getConfig();
    assert(overriddenConfig.productEdition === 'Premium', 'Edition override failure');
    assert(overriddenConfig.productVersion === '2.0.0-PRO', 'Version override failure');

    // クリーンアップ
    delete (globalVar as any).POSTING_MAP_CONFIG;
    console.log('[Test ProductRC] ProductConfiguration: PASSED');
  }

  // 2. FeatureToggle Test
  {
    const toggleInstance = FeatureToggle.getInstance();
    
    // Standard エディションでのデフォルト値
    const standardFeatures = toggleInstance.getFeatures('Standard');
    assert(standardFeatures.googleMaps === true, 'Google Maps should be enabled in Standard');
    assert(standardFeatures.mapbox === false, 'Mapbox should be disabled in Standard');
    assert(standardFeatures.flyerHolding === true, 'Flyer Holding should be enabled in Standard');
    assert(standardFeatures.aiosBridge === false, 'AIOS Bridge should be disabled in Standard');

    // Premium エディションでのデフォルト値
    const premiumFeatures = toggleInstance.getFeatures('Premium');
    assert(premiumFeatures.mapbox === true, 'Mapbox should be enabled in Premium');
    assert(premiumFeatures.aiosBridge === true, 'AIOS Bridge should be enabled in Premium');

    // オーバーライド検証
    (globalVar as any).POSTING_MAP_CONFIG = {
      FEATURE_TOGGLES: {
        flyerHolding: false,
        mapbox: false
      }
    };
    const customFeatures = toggleInstance.getFeatures('Premium');
    assert(customFeatures.flyerHolding === false, 'Flyer Holding override failure');
    assert(customFeatures.mapbox === false, 'Mapbox override failure');

    // クリーンアップ
    delete (globalVar as any).POSTING_MAP_CONFIG;
    console.log('[Test ProductRC] FeatureToggle: PASSED');
  }

  // 3. ProductRuntimeValidator Test
  {
    // API URL 不足エラー
    const res1 = ProductRuntimeValidator.validate('', 'MIE-03', 'MIE-03', 'app');
    assert(res1.success === false, 'Validation should fail when API URL is missing');
    assert(res1.errors.some(e => e.includes('API URL (apiUrl) is required')), 'Expected error missing');

    // DOM 不足エラー
    const res2 = ProductRuntimeValidator.validate('https://api.test', 'MIE-03', 'MIE-03', 'missing-dom-id');
    assert(res2.success === false, 'Validation should fail when Mount DOM element is missing');

    // Edition Matrix 不整合エラー (Standard で Premium機能が ON になっている場合)
    (globalVar as any).POSTING_MAP_CONFIG = {
      PRODUCT_EDITION: 'Standard',
      FEATURE_TOGGLES: {
        mapbox: true // Standardでは不当なON
      }
    };
    const res3 = ProductRuntimeValidator.validate('https://api.test', 'MIE-03', 'MIE-03', 'app');
    assert(res3.success === false, 'Validation should fail for Premium feature in Standard edition');
    assert(res3.errors.some(e => e.includes('Mapbox" is premium-only')), 'Expected Edition Matrix error missing');

    // Feature Dependency: 全マップエンジンOFFエラー
    (globalVar as any).POSTING_MAP_CONFIG = {
      PRODUCT_EDITION: 'Premium',
      FEATURE_TOGGLES: {
        googleMaps: false,
        mapbox: false
      }
    };
    const res4 = ProductRuntimeValidator.validate('https://api.test', 'MIE-03', 'MIE-03', 'app');
    assert(res4.success === false, 'Validation should fail when no map engine is enabled');
    assert(res4.errors.some(e => e.includes('At least one map engine')), 'Expected Map engine validation error missing');

    // AIOS Bridge が ON だが AIOS_ENDPOINT が無いエラー
    (globalVar as any).POSTING_MAP_CONFIG = {
      PRODUCT_EDITION: 'Premium',
      FEATURE_TOGGLES: {
        googleMaps: true,
        aiosBridge: true
      }
    };
    const res5 = ProductRuntimeValidator.validate('https://api.test', 'MIE-03', 'MIE-03', 'app');
    assert(res5.success === false, 'Validation should fail when AIOS Bridge endpoint is missing');

    // 全てのパラメータ・整合性が正常な場合
    (globalVar as any).POSTING_MAP_CONFIG = {
      PRODUCT_EDITION: 'Premium',
      AIOS_ENDPOINT: 'https://aios.test',
      FEATURE_TOGGLES: {
        googleMaps: true,
        mapbox: true,
        aiosBridge: true
      }
    };
    const res6 = ProductRuntimeValidator.validate('https://api.test', 'MIE-03', 'MIE-03', 'app');
    assert(res6.success === true, 'Validation should succeed with clean parameters');

    // クリーンアップ
    delete (globalVar as any).POSTING_MAP_CONFIG;
    console.log('[Test ProductRC] ProductRuntimeValidator: PASSED');
  }

  // 4. DashboardApplication Validation Boot Block Test
  {
    const app = DashboardApplication.getInstance();
    
    // バリデーションエラーになるパラメータで start を呼び出し、起動が阻害されることを検証
    let threw = false;
    try {
      await app.start({} as any, '', 'MIE-03', 'MIE-03');
    } catch (err: any) {
      threw = true;
      assert(err.message.includes('Boot Validation Failure'), 'Error message should indicate validation failure');
    }
    assert(threw === true, 'DashboardApplication must block startup on validation errors');

    console.log('[Test ProductRC] DashboardApplication Validation Hook: PASSED');
  }

  console.log('[Test ProductRC] All Product Release Candidate tests completed successfully.');
}

runTests().then(() => {
  console.log('\n======================================');
  console.log('  PRODUCT RELEASE CANDIDATE PASSED');
  console.log('======================================\n');
}).catch(err => {
  console.error('[ProductRC Test Failure]', err);
  if (typeof (globalThis as any).process !== 'undefined') {
    (globalThis as any).process.exit(1);
  }
});
