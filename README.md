# playwright-report-grid
> A grid style report for playwright

## Install
```sh
npm i playwright-report-grid
```

## Playwright Multiple Reporters
```js
// playwright.config.js
module.exports = {
reporter: [
  //['list'],
  ['playwright-report-grid', {  
    outputFile: 'playwright-report/report.html'
  }]
]
};
```
more [https://playwright.dev/docs/test-reporters](https://playwright.dev/docs/test-reporters)

## CHANGELOG

* v1.0.3 new UI