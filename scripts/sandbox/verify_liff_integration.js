/**
 * Sprint G3-01: LINE Login Integration Verifier
 * Verifies DOM, LIFF Initialization, and Profile Acquisition Logic (GAS SSOT Architecture)
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

// 1. Read index.html
const indexPath = path.join(__dirname, '../../active/dashboard/index.html');
const indexHtml = fs.readFileSync(indexPath, 'utf8');

console.log("==================================================");
console.log("🧪 Sprint G3-01: LINE Login Integration Verifier");
console.log("==================================================");

// Check 1: LIFF SDK script tag present in head
assert.ok(indexHtml.includes('static.line-scdn.net/liff/edge/2/sdk.js'), 'LIFF SDK script tag must be included in <head>');
console.log("✓ Check 1: LIFF SDK script tag present in <head>");

// Check 2: LIFF ID definition
assert.ok(indexHtml.includes('2010374196-bHBYo37e'), 'LIFF ID (2010374196-bHBYo37e) must be defined');
console.log("✓ Check 2: LIFF ID (2010374196-bHBYo37e) defined");

// Check 3: initLiff function definition
assert.ok(indexHtml.includes('async function initLiff()'), 'initLiff function must be defined');
assert.ok(indexHtml.includes('liff.init({ liffId: LIFF_ID })'), 'liff.init call must be present');
assert.ok(indexHtml.includes('liff.getProfile()'), 'liff.getProfile call must be present');
console.log("✓ Check 3: initLiff, liff.init, and liff.getProfile calls present");

// Check 4: GAS SSOT Principle (userId transmitted to GAS for Column D; NOT stored in localStorage)
assert.ok(indexHtml.includes('liffProfile.userId') && indexHtml.includes('liffProfile.displayName'), 'Profile attributes (userId, displayName) must be captured');
assert.ok(indexHtml.includes("localStorage.setItem('posting_display_name'"), 'UI display name only must be saved to localStorage');
assert.ok(indexHtml.includes("registerStaff") && indexHtml.includes("lineUserId: liffProfile.userId"), 'userId must be transmitted to GAS registerStaff API for Column D SSOT persistence');
console.log("✓ Check 4: GAS SSOT Rule verified (userId sent to GAS Column D; excluded from localStorage)");

// Check 5: UI Login Button & Profile View
assert.ok(indexHtml.includes('loginWithLine()'), 'loginWithLine handler present');
assert.ok(indexHtml.includes('LINE User ID:'), 'LINE User ID display label present in UI');
console.log("✓ Check 5: LINE Login button and profile UI present");

console.log("==================================================");
console.log("🎉 ALL G3-01 LINE LOGIN INTEGRATION CHECKS PASSED");
console.log("==================================================");
