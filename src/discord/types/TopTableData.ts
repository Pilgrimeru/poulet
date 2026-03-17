export interface TopTableRow {
  rank: number;
  pseudo: string;
  vocal: string;
  message: number;
}

export interface TopTableData {
  rows: TopTableRow[];
  totalVocal: string;
  totalMessages: number;
}
