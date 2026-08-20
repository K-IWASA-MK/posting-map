/**
 * Auto-generated AssetRegistry
 * Static workspace locator for POSTING MAP Assets
 */
function getAssetRegistry() {
  return {
  "updatedAt": 1784371396312,
  "schemaVersion": 1,
  "templates": {
    "spreadsheetId": "14rblnvJH5hkXHU9-9lhZlDaUi-FenuQQ5DWnTP7TbW4",
    "scriptId": "17VISNdxQLpxkR18XR4AMXRwDBSa600AJFIwrqDriQYxo8Tsot2DvXAzX",
    "webAppUrl": "https://script.google.com/macros/s/AKfycbyjNwgZ_6CCv258lqKMrCXJYi0wDR23ZCyyzOQIV1R_WcCF5TQxYXOzZWWSJd_vMyu_/exec",
    "version": "v1",
    "projectName": "三重県第3区",
    "lastUpdated": "2026-07-18T10:19:49.420Z",
    "driveFileId": "17VISNdxQLpxkR18XR4AMXRwDBSa600AJFIwrqDriQYxo8Tsot2DvXAzX"
  },
  "masters": {
    "global": {
      "electionMaster": {
        "fileId": "",
        "name": "三重県選挙区区割り.csv",
        "location": "01_MASTER/Reference"
      }
    },
    "districts": {
      "MIE-04": {
        "spreadsheetId": "1n2xYOW_rinS-mDzVSOPz9aDmT8ihPUOri59CfMLnCsg",
        "storageFolderId": "1j45kdXmU9pj-tY7QQmjB3nvINz4zCesN",
        "gasScriptId": "",
        "productionLiffUrl": ""
      },
      "MIE-05": {
        "spreadsheetId": "1nwreNCMn2f_wcBW4658xgxLyb8udUJlYXydh0dpTpLM",
        "storageFolderId": "1uoCwkEITDxoQjvVkl2G4djA34wMQS9eV",
        "gasScriptId": "",
        "productionLiffUrl": ""
      },
      "posting-map-snapshot": {
        "spreadsheetId": "",
        "storageFolderId": "1hjoDkBQ-q7YWuHwOZaLmqEHTlJwvcMHY",
        "gasScriptId": "",
        "productionLiffUrl": ""
      },
      "MIE-03": {
        "spreadsheetId": "14rblnvJH5hkXHU9-9lhZlDaUi-FenuQQ5DWnTP7TbW4",
        "storageFolderId": "",
        "gasScriptId": "17VISNdxQLpxkR18XR4AMXRwDBSa600AJFIwrqDriQYxo8Tsot2DvXAzX",
        "productionLiffUrl": "https://liff.line.me/2010941735-GRLuqPic"
      }
    }
  },
  "dashboard": {
    "assets": []
  },
  "storage": {
    "rootFolderId": "1FyM4wCIqWJovbcsMZ6h9JKFQxhgwciGb"
  }
};
}

function getTemplateSpreadsheetId() {
  return "14rblnvJH5hkXHU9-9lhZlDaUi-FenuQQ5DWnTP7TbW4";
}

function getTemplateScriptId() {
  return "17VISNdxQLpxkR18XR4AMXRwDBSa600AJFIwrqDriQYxo8Tsot2DvXAzX";
}

function getTemplateWebAppUrl() {
  return "https://script.google.com/macros/s/AKfycbyjNwgZ_6CCv258lqKMrCXJYi0wDR23ZCyyzOQIV1R_WcCF5TQxYXOzZWWSJd_vMyu_/exec";
}

function getProductionLiffUrl(districtId) {
  const dId =
    districtId ||
    (typeof CONFIG !== 'undefined' &&
     typeof CONFIG.get === 'function'
      ? CONFIG.get("DEFAULT_BRANCH_ID")
      : null);

  if (!dId) {
    throw new Error(
      "PRODUCTION_LIFF_URL_ERROR: Active districtId cannot be resolved."
    );
  }

  const registry = getAssetRegistry();

  const district =
    registry.masters &&
    registry.masters.districts &&
    registry.masters.districts[dId];

  if (!district || !district.productionLiffUrl) {
    throw new Error(
      "PRODUCTION_LIFF_URL_ERROR: productionLiffUrl is not configured for district: " +
      dId
    );
  }

  return district.productionLiffUrl;
}

function getPostalMaster() {
  return getAssetRegistry().masters.global.postalMaster || null;
}

function getAddressMaster() {
  return getAssetRegistry().masters.global.addressMaster || null;
}

function getElectionMaster() {
  return getAssetRegistry().masters.global.electionMaster || null;
}

function getDistrictAssets(districtId) {
  return getAssetRegistry().masters.districts[districtId] || null;
}
