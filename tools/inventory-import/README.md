# Inventory Import 工具

把 Excel 裡的內嵌商品圖批次抽出來，**檔名自動加上 brand/model/size/color**，
方便用檔案總管「大圖示」檢視看著縮圖一張張對應 SKU 上傳到前端。

> 這個工具只做本地處理（extract），**不會連 DB、不會自動上傳**。
> 上傳由你在前端「商品管理」手動做（42 張左右、不算多）。
> 為了未來再用（防寒衣、板子等等），腳本仍保留在 repo 中。

## 流程

```
lifejackets.xlsx
      │
      ▼ npm run extract
extracted/
  ├── row02__LF_Heartbreaker-Cga__XS__粉橘.jpg
  ├── row04__LF_BreezeComp__S__紫混染.jpg
  ├── ...
  └── _unmatched__anchor45__#36.jpg   ← anchor 在表外的圖
      │
      ▼ 你開檔案總管「大圖示」，對著前端逐一上傳
```

---

## 1. 安裝（第一次）

```powershell
cd tools\inventory-import
npm install
```

## 2. 把 xlsx 放好

把 Excel 檔案放到 `tools/inventory-import/lifejackets.xlsx`。
**這個檔已被 .gitignore 排除，不會 commit。**

## 3. 抽圖

```powershell
npm run extract
```

完成後 console 會印出統計，例如：

```
✓ 已抽出 35 張 (對到 row 的)
⚠ 7 張 anchor 在表外，存成 _unmatched__... 開頭

📋 7 個 SKU 沒拿到圖：
   row03  LF  Heartbreaker Cga  2255549  S(C81-91cm)  粉橘
   row07  Follow  Signal Ladies F12303-CE L12         酒紅
   ...
```

「對到 row」的圖：檔名直接告訴你是哪個 SKU，照名上傳即可。

「anchor 在表外」的圖：通常是被使用者拖到表格下方的浮動圖。看縮圖內容對應「沒拿到圖的 SKU」清單即可。

## 4. 上傳

開檔案總管 →「大圖示 / 超大圖示」檢視看縮圖 → 對著前端「📦 商品管理」每筆 SKU 編輯頁拖檔上傳。

## 重跑

腳本是 idempotent，每次跑會清空 `extracted/` 重抽。

---

## 之後其他類別

防寒衣 / 板子的話，複製這個資料夾改：
- 換 `XLSX` 路徑
- 改 `COL_BRAND/COL_MODEL/COL_VENDOR/COL_SIZE/COL_COLOR` 欄位編號

或者跟我講，我幫你做。
