const http = require('http');
const url = require('url');
const requestFunctions = require('./server_modules/requestFunctions');

const PORT = process.env.PORT || 8139;

const server = http.createServer((req, res) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname.replace(/\/+/g, '/');

    console.log(`Request received: ${req.method} ${pathname}`);

    if (pathname === '/register') {
        requestFunctions.register(req, res);
    } else if (pathname === '/ranking') {
        requestFunctions.ranking(req, res);
    } else if (pathname === '/join') {
        requestFunctions.join(req, res);
    } else if (pathname === '/update') {
        requestFunctions.update(req, res);
    } else if (pathname === '/leave') {
        requestFunctions.leave(req, res);
    } else if (pathname === '/notify') {
        requestFunctions.notify(req, res);
    } else if (pathname === '/roll') {
        requestFunctions.roll(req, res);
    } else if (pathname === '/pass') {
        requestFunctions.pass(req, res);
    } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Endpoint not found' }));
    }
});

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
});
