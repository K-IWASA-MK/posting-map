/**
 * POSTING MAP Client Configuration
 * Client: MIE-03 (三重県第3区)
 * 
 * 地区インスタンス定義ファイル
 * 
 * Application Code は地区を知らない。
 * 地区固有情報はすべてこのファイルに集約する。
 * 新地区デプロイ時はこのファイルと data/*.csv を差し替える。
 */
window.PMS_CLIENT_CONFIG = {
  districtId: "MIE-03",
  districtName: "三重3区",
  status: "ACTIVE_DEVELOPMENT",
  
  spreadsheetId: "1xQUvlCaUO103rjSGmdcFQQFkukodG4Dg9mS_teWT7uA",
  environment: "production",
  api: {
    gasWebAppUrl: "https://script.google.com/macros/s/AKfycbyjNwgZ_6CCv258lqKMrCXJYi0wDR23ZCyyzOQIV1R_WcCF5TQxYXOzZWWSJd_vMyu_/exec"
  },
  staticMaster: {
    addressCsvFilename: "MIE03_ADDRESS_MASTER_858.csv",
    boundariesGeojsonFilename: "MIE03_BOUNDARIES.geojson",
    mapDefaultCenter: [35.0641, 136.6200],
    mapDefaultZoom: 11
  },
  line: {
    liffId: "2010941735-GRLuqPic"
  },
  features: {
    photoUpload: true,
    gpsTracking: true
  }
};
