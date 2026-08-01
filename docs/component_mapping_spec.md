# Component Mapping Specification

## 1. 概要 (Overview)

本仕様書は、Figma Dev Mode から抽出されたコンポーネント構造・バリアント仕様・Auto Layout パラメータを、H-App の共通レンダリング関数（`/components/*.js`）および HTML/CSS スニペットへ正確に変換するためのマッピング規約を定義します。

対象コンポーネント：**Button, Card, Input, Badge, Header, Navigation**

---

## 2. コンポーネント別変換マッピング (Component Mapping Rules)

### ① Button Component (`components/card.js` / inline CSS)

* **Figma Structure**: `Frame (Auto Layout: Horizontal)` / `Text`
* **Dev Mode Specs**: 
  * `height: 48px`, `padding: 0 24px`, `border-radius: 16px` (`var(--radius-btn)`)
  * `background: #f4700f` (`var(--color-primary)`), `color: #ffffff`
* **HTML/CSS Rule**:
  ```html
  <button class="btn-primary" style="height: 48px; border-radius: var(--radius-btn); background: var(--color-primary); color: #fff; padding: 0 var(--space-24); font-weight: 700; display: flex; align-items: center; justify-content: center;">
    ${label}
  </button>
  ```

---

### ② Card Component (`components/card.js`)

* **Figma Structure**: `Frame (Auto Layout: Vertical)` / `Corner Radius: 24px` / `Glass Effect`
* **Dev Mode Specs**: 
  * `background: rgba(28,28,30,0.65)` (`var(--color-bg-card)`), `backdrop-filter: blur(12px)`
  * `border: 1px solid rgba(255,255,255,0.08)`, `padding: 24px` (`var(--space-24)`)
* **HTML/CSS Rule**:
  ```javascript
  window.renderCard = function(contentHtml, options = {}) {
    return `
      <div class="glass-card" style="background: var(--color-bg-card); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.08); border-radius: var(--radius-card); padding: var(--space-24);">
        ${contentHtml}
      </div>
    `;
  };
  ```

---

### ③ Input Component (`components/card.js` / Settings Input)

* **Figma Structure**: `Frame (Auto Layout: Horizontal)` / `Text (Placeholder)`
* **Dev Mode Specs**: 
  * `height: 48px`, `padding: 0 16px`, `border-radius: 12px` (`var(--radius-small)`)
  * `background: #111315` (`var(--color-bg-surface)`), `border: 1px solid rgba(255,255,255,0.08)`
* **HTML/CSS Rule**:
  ```html
  <input type="text" class="input-field" style="height: 48px; border-radius: var(--radius-small); background: var(--color-bg-surface); border: 1px solid rgba(255,255,255,0.08); color: #fff; padding: 0 var(--space-16); width: 100%;" placeholder="${placeholder}" value="${value}">
  ```

---

### ④ Badge Component (`components/badge.js`)

* **Figma Structure**: `Frame (Auto Layout: Horizontal)` / `Dot Icon` / `Text`
* **Dev Mode Specs**: 
  * `height: 22px`, `padding: 0 8px`, `border-radius: 9999px` (`var(--radius-full)`)
  * `font-size: 10px`, `font-weight: 800`
* **HTML/CSS Rule**:
  ```javascript
  window.renderBadge = function(text, type = 'success') {
    const colorMap = {
      success: 'var(--color-success)',
      warning: 'var(--color-warning)',
      danger: 'var(--color-danger)'
    };
    return `
      <span class="status-badge" style="height: 22px; padding: 0 var(--space-8); border-radius: var(--radius-full); background: rgba(255,255,255,0.05); border: 1px solid ${colorMap[type]}; color: ${colorMap[type]}; font-size: 10px; font-weight: 800; display: inline-flex; align-items: center; gap: 4px;">
        <span style="width: 6px; height: 6px; border-radius: 50%; background: ${colorMap[type]};"></span>
        ${text}
      </span>
    `;
  };
  ```

---

### ⑤ Header Component (`components/card.js`)

* **Figma Structure**: `Frame (Horizontal)` / `Logo` / `Status Badge`
* **Dev Mode Specs**: 
  * `height: 64px`, `padding: 0 16px`, `background: #000000` (`var(--color-bg-base)`)
  * `border-bottom: 1px solid rgba(255,255,255,0.05)`
* **HTML/CSS Rule**:
  ```html
  <header style="height: 64px; padding: 0 var(--space-16); background: var(--color-bg-base); border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: space-between;">
    <div class="logo-area">${logoHtml}</div>
    <div class="status-area">${statusBadgeHtml}</div>
  </header>
  ```

---

### ⑥ Navigation Component (`components/navigation.js`)

* **Figma Structure**: `Frame (Horizontal)` / `Nav Items (Equal Width)`
* **Dev Mode Specs**: 
  * `height: 72px`, `padding: 12px 24px`, `background: #111315` (`var(--color-bg-surface)`)
  * `border-top: 1px solid rgba(255,255,255,0.08)`
* **HTML/CSS Rule**:
  ```javascript
  window.renderBottomNavigation = function(activePage) {
    // Navigation implementation using var(--space-12) and var(--color-bg-surface)
  };
  ```
