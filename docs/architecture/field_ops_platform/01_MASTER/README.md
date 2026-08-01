# 01_MASTER

## 役割
POSTING MAP システム全体および組織全体のマスター原本（テンプレート）を管理する領域。

---

# ■ POSTING MAP Master Governance Rule

### Rule-001: MASTER昇格ルール

#### 原則
MASTERは固定ファイルではない。運用中に改善されたスプレッドシートが十分に検証・承認された場合、そのスプレッドシートを新しいMASTERへ昇格させる。

#### 更新フロー
```
MASTER v1
  │
  ├─ MIE-03 v1
  ├─ NARA-07 v1
  └─ TOKYO-15 v1
      │
     改善
      ↓
    レビュー
      ↓
     承認
      ↓
  MASTER v2
```

#### 新規支部作成ルール
新しい支部は、必ず最新のMASTERから作成する。
```
MASTER（最新版） → 支部作成
```

#### 旧MASTERの管理
旧MASTERは絶対に削除しない。`01_MASTER/Archive/` 配下へバージョン管理保存する。
```
01_MASTER/
├── POSTING_MAP_MASTER.json   <-- MASTER（最新版）
└── Archive/
    ├── MASTER_v1/
    ├── MASTER_v2/
    └── ...
```

---

### Rule-002: MASTER変更条件

MASTERへ昇格できるのは、以下3点を満たしたスプレッドシートのみとする。
1. **検証完了** (動作・数式・API連動の全テストPASS)
2. **運用確認完了** (現場および実機での安定稼働を確認)
3. **承認完了** (岩佐CEO / AI Governanceによる品質承認)

---

### Rule-003: 世代追跡・リネージルール (Lineage Traceability)

全国展開時の各支部の一貫した品質管理と監査のため、原本および全支部に作成元の「世代（バージョン）情報」を不可逆記録する。

---

### Rule-004: Version Immutability Rule & Spreadsheet Title Rule

#### 原則 (Version Immutability)
1. 支部は作成時に使用した MASTER の世代を永久に保持するものとする。
2. 既存支部は、MASTER が新しいバージョンへ昇格してもアップグレードしてはならない。
3. これにより、データ整合性・帳票整合性・AI分析結果・監査・リネージを完全に保証する。

#### Spreadsheet Title Rule (スプレッドシートファイル名規則)
支部作成時のスプレッドシートファイル名（画面左上タイトル）は、**`[支部コード] v[MASTERMajor世代]`** とする。
内部のシートタブ名は原本のまま一切変更してはならない（原本構造を100%保持）。

例：
- スプレッドシート名（ファイル名・画面左上）: `MIE-03 v1`
- 内部シート（タブ）名: 変えてはならない（原本のシート名を完全保持）

---

### Rule-005: Branch File Immutability & Upgrade Migration Protocol

#### 原則 (支部ファイルの永久不変性)
1. **支部ファイル・スプレッドシート自体は不変（Immutable）** とする。
2. 運用開始後の実績・配布ログ・地域データは `MIE-03 v1` のように作成時の環境に蓄積・固定され、過去の事実として永久保存される。
3. 新しい MASTER（例: `MASTER v2`）の新機能を採用する場合は、既存ファイルを上書き・改変するのではなく、**新しい支部環境（例: `MIE-03 v2`）として別体生成**する。

---

## Google Drive 同期保存ルール (必修)
- **Google Drive ルートフォルダ**: `FIELD_OPERATIONS_PLATFORM`
- **フォルダ ID**: `1FfcVEQjod--rZSucOPFJD2DJ58hV650_`
- **URL**: `https://drive.google.com/drive/folders/1FfcVEQjod--rZSucOPFJD2DJ58hV650_`

## 運用・複製プロトコル
新しい支部を追加する場合は、必ず以下の手順のみで作成する。

1. `01_MASTER` 内の**最新の MASTER スプレッドシート**から複製作成
2. コピーしたスプレッドシートのファイル名（画面左上）を `{branchId} v{masterVersionMajor}` （例: `MIE-03 v1`）に設定
3. 内部のシート（タブ）名は変更せず、原本のまま100%保持
4. 支部の `deployment.json` に `masterVersion` および `createdFrom` を記録
