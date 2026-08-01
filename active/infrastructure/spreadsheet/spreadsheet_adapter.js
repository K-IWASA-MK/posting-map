/**
 * Infrastructure Layer - Spreadsheet Adapter Module
 * 
 * Section: SEC-004 getSS(), SEC-034 Batch Reader/Writer, SEC-035 SpreadsheetRepository
 * Owner Layer: Infrastructure Layer
 * Responsibility: SpreadsheetApp へのアクセス、シート読み書き、データリポジトリの抽象化とカプセル化
 */

function getSS() {
  if (typeof isWebAppCall !== 'undefined' && !isWebAppCall) {
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      if (ss && ss.getId()) {
        return ss;
      }
    } catch (e) {}
  }

  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty("SPREADSHEET_ID");
  
  if (!id) {
    console.error('[getSS] SPREADSHEET_ID が未設定です。PropertiesServiceに設定してください。');
    throw new Error('SPREADSHEET_ID is not configured. Please set it in Script Properties.');
  }
  return SpreadsheetApp.openById(id);
}

class SpreadsheetBatchReader {
  constructor() {
    this.configProvider = (typeof GasConfigurationProvider !== 'undefined') ? GasConfigurationProvider.getInstance() : null;
    this.cachedSpreadsheet = null;
  }
  getSpreadsheet() {
    if (this.cachedSpreadsheet) return this.cachedSpreadsheet;
    const ssId = this.configProvider ? this.configProvider.getSpreadsheetId() : PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
    this.cachedSpreadsheet = SpreadsheetApp.openById(ssId);
    return this.cachedSpreadsheet;
  }
  readAll(sheetName) {
    if (typeof GasPerformanceMonitor !== 'undefined') GasPerformanceMonitor.getInstance().recordSpreadsheetRead();
    const ss = this.getSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return [];
    const lastRow = sheet.getLastRow();
    const lastColumn = sheet.getLastColumn();
    if (lastRow === 0 || lastColumn === 0) return [];
    return sheet.getRange(1, 1, lastRow, lastColumn).getValues();
  }
  readRange(sheetName, startRow, startCol, numRows, numCols) {
    if (typeof GasPerformanceMonitor !== 'undefined') GasPerformanceMonitor.getInstance().recordSpreadsheetRead();
    const ss = this.getSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return [];
    return sheet.getRange(startRow, startCol, numRows, numCols).getValues();
  }
}

class SpreadsheetBatchWriter {
  constructor() {
    this.configProvider = (typeof GasConfigurationProvider !== 'undefined') ? GasConfigurationProvider.getInstance() : null;
    this.cachedSpreadsheet = null;
  }
  getSpreadsheet() {
    if (this.cachedSpreadsheet) return this.cachedSpreadsheet;
    const ssId = this.configProvider ? this.configProvider.getSpreadsheetId() : PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
    this.cachedSpreadsheet = SpreadsheetApp.openById(ssId);
    return this.cachedSpreadsheet;
  }
  appendRows(sheetName, rows) {
    if (rows.length === 0) return;
    if (typeof GasPerformanceMonitor !== 'undefined') GasPerformanceMonitor.getInstance().recordSpreadsheetWrite();
    const ss = this.getSpreadsheet();
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }
    const lastRow = sheet.getLastRow();
    sheet.getRange(lastRow + 1, 1, rows.length, rows[0].length).setValues(rows);
  }
  updateRange(sheetName, startRow, startCol, rows) {
    if (rows.length === 0) return;
    if (typeof GasPerformanceMonitor !== 'undefined') GasPerformanceMonitor.getInstance().recordSpreadsheetWrite();
    const ss = this.getSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) throw new Error("Sheet not found: " + sheetName);
    sheet.getRange(startRow, startCol, rows.length, rows[0].length).setValues(rows);
  }
}

class SpreadsheetRepository {
  constructor() {
    this.reader = new SpreadsheetBatchReader();
    this.writer = new SpreadsheetBatchWriter();
  }
  getAreas(tenantId, branchId) {
    const rawRows = this.reader.readAll('Areas');
    if (rawRows.length <= 1) return [];
    const records = [];
    const headers = rawRows[0];
    const areaIdIdx = headers.indexOf('Area ID');
    const nameIdx = headers.indexOf('Name');
    const cityIdx = headers.indexOf('City');
    const statusIdx = headers.indexOf('Status');
    const doneIdx = headers.indexOf('Done Count');
    const totalIdx = headers.indexOf('Total Count');
    for (let i = 1; i < rawRows.length; i++) {
      const row = rawRows[i];
      records.push({
        areaId: areaIdIdx !== -1 ? String(row[areaIdIdx]) : '',
        name: nameIdx !== -1 ? String(row[nameIdx]) : '',
        cityName: cityIdx !== -1 ? String(row[cityIdx]) : '',
        status: statusIdx !== -1 ? String(row[statusIdx]) : 'NOT_STARTED',
        doneCount: doneIdx !== -1 ? Number(row[doneIdx]) : 0,
        totalCount: totalIdx !== -1 ? Number(row[totalIdx]) : 0
      });
    }
    return records;
  }
  saveEventLogs(logs) {
    if (logs.length === 0) return;
    const rawRows = this.reader.readAll('EventLogs');
    const headers = rawRows.length > 0 ? rawRows[0] : ['Event ID', 'Timestamp', 'Type', 'Payload'];
    const formattedRows = logs.map(log => {
      return headers.map(h => {
        if (h === 'Event ID') return log.eventId || ("EV-" + Date.now() + "-" + Math.random().toString(36).substr(2, 4));
        if (h === 'Timestamp') return log.timestamp || Date.now();
        if (h === 'Type') return log.type || 'unknown';
        if (h === 'Payload') return JSON.stringify(log.payload || {});
        return '';
      });
    });
    this.writer.appendRows('EventLogs', formattedRows);
  }
  getStaffs() {
    const rawRows = this.reader.readAll('Staffs');
    if (rawRows.length <= 1) return [];
    const headers = rawRows[0];
    const lastIdx = headers.indexOf('Last Name');
    const firstIdx = headers.indexOf('First Name');
    const statusIdx = headers.indexOf('Status');
    const records = [];
    for (let i = 1; i < rawRows.length; i++) {
      const row = rawRows[i];
      records.push({
        lastName: lastIdx !== -1 ? String(row[lastIdx]) : '',
        firstName: firstIdx !== -1 ? String(row[firstIdx]) : '',
        status: statusIdx !== -1 ? String(row[statusIdx]) : 'ACTIVE'
      });
    }
    return records;
  }
  updateAreaStatus(areaId, status) {
    const rawRows = this.reader.readAll('Areas');
    if (rawRows.length <= 1) return;
    const headers = rawRows[0];
    const areaIdIdx = headers.indexOf('Area ID');
    const statusIdx = headers.indexOf('Status');
    if (areaIdIdx === -1 || statusIdx === -1) return;
    for (let i = 1; i < rawRows.length; i++) {
      const row = rawRows[i];
      if (String(row[areaIdIdx]) === areaId) {
        this.writer.updateRange('Areas', i + 1, statusIdx + 1, [[status]]);
        break;
      }
    }
  }
}
