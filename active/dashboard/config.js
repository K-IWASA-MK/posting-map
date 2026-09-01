/**
 * POSTING MAP - Frontend Configuration
 * アプリのフロントエンド側（Dashboard, 配布員アプリ）で共通して読み込まれる設定ファイル。
 * 地区固有のビジネス情報は保持せず、インフラ設定と汎用データファイル名のみを持つ。
 * 新地区デプロイ時はこのファイル内の GAS URL 等と data/*.csv を差し替える。
 */
window.PMS_CLIENT_CONFIG = {
  version: "1.0.1",
  status: "ACTIVE_DEVELOPMENT",
  
  spreadsheetId: "1xQUvlCaUO103rjSGmdcFQQFkukodG4Dg9mS_teWT7uA",
  environment: "production",
  api: {
    gasWebAppUrl: "https://script.google.com/macros/s/AKfycbyjNwgZ_6CCv258lqKMrCXJYi0wDR23ZCyyzOQIV1R_WcCF5TQxYXOzZWWSJd_vMyu_/exec"
  },
  staticMaster: {
    addressCsvFilename: "address_master.csv",
    boundariesGeojsonFilename: "area_master.geojson",
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
