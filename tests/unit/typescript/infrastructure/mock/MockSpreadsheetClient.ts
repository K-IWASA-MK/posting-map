import { SpreadsheetClient } from '@infra/spreadsheet/SpreadsheetClient';

export class MockRange {
  constructor(
    private sheet: MockSheet,
    private startRow: number,
    private startCol: number,
    private numRows: number,
    private numCols: number
  ) {}

  public getValues(): any[][] {
    const values: any[][] = [];
    for (let r = 0; r < this.numRows; r++) {
      const rowIdx = this.startRow - 1 + r;
      const row: any[] = [];
      for (let c = 0; c < this.numCols; c++) {
        const colIdx = this.startCol - 1 + c;
        row.push(this.sheet.data[rowIdx]?.[colIdx] ?? '');
      }
      values.push(row);
    }
    return values;
  }

  public setValues(values: any[][]): void {
    for (let r = 0; r < values.length; r++) {
      const rowIdx = this.startRow - 1 + r;
      if (!this.sheet.data[rowIdx]) {
        this.sheet.data[rowIdx] = [];
      }
      for (let c = 0; c < values[r].length; c++) {
        const colIdx = this.startCol - 1 + c;
        this.sheet.data[rowIdx][colIdx] = values[r][c];
      }
    }
  }
}

export class MockSheet {
  public data: any[][] = [];

  constructor(initialData: any[][] = []) {
    this.data = initialData.map(row => [...row]);
  }

  public getLastRow(): number {
    return this.data.length;
  }

  public getLastColumn(): number {
    if (this.data.length === 0) return 0;
    return Math.max(...this.data.map(row => row.length));
  }

  public getRange(row: number, col: number, numRows: number, numCols: number): MockRange {
    return new MockRange(this, row, col, numRows, numCols);
  }
}

export class MockSpreadsheet {
  private sheets: Record<string, MockSheet> = {};

  constructor() {}

  public addSheet(name: string, initialData: any[][] = []): MockSheet {
    const sheet = new MockSheet(initialData);
    this.sheets[name] = sheet;
    return sheet;
  }

  public getSheetByName(name: string): MockSheet | null {
    return this.sheets[name] ?? null;
  }
}

export class MockSpreadsheetClient {
  private mockSpreadsheet: MockSpreadsheet;

  constructor() {
    this.mockSpreadsheet = new MockSpreadsheet();
  }

  public getSpreadsheet(): MockSpreadsheet {
    return this.mockSpreadsheet;
  }

  public static createAndInject(): MockSpreadsheetClient {
    const mockClient = new MockSpreadsheetClient();
    SpreadsheetClient.setMockInstance(mockClient as any);
    return mockClient;
  }
}
