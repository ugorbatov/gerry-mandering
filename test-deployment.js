// TEST FILE - VERSION 2.0 (May 12, 2026)
// If you see "VERSION 2.0" on the page, the deployment worked!
// If you see "VERSION 1.0", you're seeing cached/old files

console.log("TEST: Loading gerrymandering-revealed test file");
console.log("DEPLOYMENT VERSION: 2.0 - UPDATED");
console.log("Last updated: May 12, 2026");

// Add a watermark to the page so we can visually confirm
document.addEventListener('DOMContentLoaded', function() {
  const testDiv = document.createElement('div');
  testDiv.id = 'deployment-test';
  testDiv.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #22C55E;
    color: white;
    padding: 12px 16px;
    border-radius: 4px;
    font-size: 11px;
    z-index: 99999;
    font-family: monospace;
  `;
  testDiv.textContent = 'VERSION 2.0 ✓ DEPLOYED';
  document.body.appendChild(testDiv);
  console.log("✓ Deployment test indicator added to page");
});
