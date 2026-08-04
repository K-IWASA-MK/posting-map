/**
 * POSTING MAP - Delete & Data Protection Governance Foundation
 * シート保護 & 業務データ保護判定基盤 (Single Source of Truth)
 * 
 * ■ Business Data Protection Rule:
 * 以下の SSOT 業務データシートは、システムによる自動削除 (deleteSheet) および
 * 自動クリア (clearContent / clear) を全面禁止します。
 *   - 保有チラシ枚数
 *   - 名簿
 *   - 受渡要請履歴
 *   - 管理者ID
 * 変更操作は利用者による直接操作、または管理者による明示的な手動操作のみ許可されます。
 */

/**
 * 指定されたシート名が保護対象（削除不可）かどうか判定する
 * @param {string} sheetName - 判定対象のシート名
 * @return {boolean} - 保護対象であれば true
 */
function isProtectedSheet(sheetName) {
  if (!sheetName) return false;

  // 第一防壁: ハードコードされた保護対象シート名リスト
  const protectedSheets = [
    "名簿",
    "原本",
    "保有チラシ枚数",
    "チラシ保管庫",
    "受渡要請履歴",
    "管理者ID",
    "__SYSTEM_CACHE__",
    "📥 集計用マスターデータ",
    "郵便番号",
    "区割り",
    "MIE03_ADDRESS_MASTER",
    "初めての方「使い方ガイド」",
    "📖 らくらくマニュアル",
    "らくらくマニュアル",
    "📄 活動報告書"
  ];

  // 第二防壁: CONFIG から動的に設定値を取得（未定義・ロード失敗でもエラーにならないよう try-catch で安全結合）
  try {
    if (typeof CONFIG !== 'undefined' && CONFIG.get) {
      const dynamicKeys = [
        "SHEET_ROSTER",
        "SHEET_TEMPLATE",
        "SHEET_STORAGE",
        "SHEET_SYSTEM_CACHE",
        "SHEET_GUIDE",
        "SHEET_POSTAL",
        "SHEET_DISTRICT",
        "SHEET_MASTER_EXPORT",
        "SHEET_REPORT",
        "SHEET_MANUAL",
        "SHEET_ADMIN"
      ];

      dynamicKeys.forEach(key => {
        const val = CONFIG.get(key);
        if (val && typeof val === 'string') {
          protectedSheets.push(val);
        }
      });
    }
  } catch (e) {
    Logger.log("isProtectedSheet: CONFIG fallback skipped due to " + e.message);
  }

  return protectedSheets.includes(sheetName);
}
