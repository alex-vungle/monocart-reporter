const path = require('path');
const http = require('http');
const EC = require('eight-colors');
const KSR = require('koa-static-resolver');
const Koa = require('koa');

const outputDir = path.resolve(__dirname, '../.temp/mock');

console.log('serve dir', outputDir);

const app = new Koa();
app.use(KSR({
    dirs: [outputDir],
    headers: {
        'Access-Control-Allow-Origin': '*'
    },
    gzip: false,
    // max-age=<seconds>
    maxAge: 1
}));

const server = http.createServer(app.callback());

const port = 8090;

const url = `http://localhost:${port}/`;

server.listen(port, function() {
    EC.logCyan(`${new Date().toLocaleString()} server listening on ${url}`);
});

