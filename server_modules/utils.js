const crypto = require('crypto');

function sendResponse(res, statusCode, data) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    if (data) {
        res.end(JSON.stringify(data));
    } else {
        res.end();
    }
}

function getRequestBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                if (!body) return resolve({});
                resolve(JSON.parse(body));
            } catch (error) {
                reject(error);
            }
        });
        req.on('error', (err) => {
            reject(err);
        });
    });
}

function hashPassword(password) {
    return crypto.createHash('md5').update(password).digest('hex');
}

function generateGameId(group, size) {
    const date = Date.now().toString();
    return crypto.createHash('md5').update(`${group}${size}${date}`).digest('hex');
}

module.exports = {
    sendResponse,
    getRequestBody,
    hashPassword,
    generateGameId
};
