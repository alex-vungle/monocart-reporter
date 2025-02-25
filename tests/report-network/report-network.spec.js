const fs = require('fs');
const path = require('path');
const { test } = require('@playwright/test');
const { attachNetworkReport } = require('monocart-reporter');
const { delay } = require('../common/util.js');

test.describe.configure({
    mode: 'serial'
});

let page;
let context;

const harPath = path.resolve('.temp/test-page.har');
if (fs.existsSync(harPath)) {
    // remove previous
    fs.rmSync(harPath);
}

test.beforeAll(async ({ browser }) => {
    console.log('beforeAll new page');
    context = await browser.newContext({
        recordHar: {
            path: harPath
        }
    });
    page = await context.newPage();
});


test('first, open page', async () => {
    // await page.goto('http://localhost:8090/playwright.dev/');
    // await page.goto('http://localhost:8080/');
    await page.goto('https://music.163.com/', {
        waitUntil: 'networkidle'
    });
});

test('next, run test cases', async () => {
    await delay(500);
});

test('finally, attach HAR', async () => {

    await page.close();

    // Close context to ensure HAR is saved to disk.
    await context.close();

    await attachNetworkReport(harPath, test.info(), {
        inline: false
    });

});
