// GAS code is managed directly in the Google Apps Script editor.

const cities = [
  ["三重県伊賀市出後", "https://www.google.com/maps/search/?api=1&query=三重県伊賀市出後"],
  ["三重県伊賀市猿野", "https://www.google.com/maps/search/?api=1&query=三重県伊賀市猿野"],
  ["三重県伊賀市下阿波", "https://www.google.com/maps/search/?api=1&query=三重県伊賀市下阿波"],
  ["三重県四日市市河原田地区市民センター管内", "https://www.google.com/maps/search/?api=1&query=三重県四日市市河原田地区市民センター管内"],
  ["三重県四日市市日永地区市民センター管内", "https://www.google.com/maps/search/?api=1&query=三重県四日市市日永地区市民センター管内"],
];

function populateAreaSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Area');
  if (!sheet) return;
  
  // Start from B2, C2
  const startRow = 2;
  const numRows = cities.length;
  
  // Clear existing
  sheet.getRange(startRow, 2, sheet.getMaxRows(), 2).clearContent();
  
  // Set values
  sheet.getRange(startRow, 2, numRows, 2).setValues(cities);
}
