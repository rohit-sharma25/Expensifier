const playwright = require('playwright');
(async () => {
    const browser = await playwright.chromium.launch();
    const page = await browser.newPage();

    page.on('console', msg => console.log('BROWSER LOG:', msg.type(), msg.text()));
    page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));

    await page.goto('http://127.0.0.1:3000/invest.html');
    await page.waitForTimeout(2000); // let db-service load

    console.log('--- Current HTML inside stocks-list ---');
    console.log(await page.evaluate(() => document.getElementById('stocks-list').innerHTML));

    console.log('--- Clicking Add Investment ---');
    await page.evaluate(() => {
        document.getElementById('add-holding-modal').style.display = 'flex';
        document.querySelector('input[name="stock_symbol"]').value = 'TSLA';
        document.querySelector('input[name="stock_name"]').value = 'Tesla';
        document.querySelector('input[name="stock_qty"]').value = '5';
        document.querySelector('input[name="stock_price"]').value = '200';
    });
    // Wait for the form to populate
    await page.waitForTimeout(1000);
    console.log('--- Submitting Form ---');
    // We override window.alert so it doesn't block the page indefinitely
    await page.evaluate(() => {
        window.alert = function (msg) { console.log("ALERT INTERCEPTED: " + msg) };
        document.querySelector('#add-investment-form button[type="submit"]').click();
    });

    await page.waitForTimeout(2000); // wait for DBService and updateUI

    console.log('--- New HTML inside stocks-list ---');
    console.log(await page.evaluate(() => {
        const list = document.getElementById('stocks-list');
        return list ? list.innerHTML : "NOT FOUND";
    }));

    await browser.close();
})();
