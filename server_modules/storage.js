const fs = require('fs');
const path = require('path');

const usersFile = path.join(__dirname, '../users.json');
const gamesFile = path.join(__dirname, '../games.json');

function readJSON(filePath) {
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        return [];
    }
}

function writeJSON(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function getUsers() {
    return readJSON(usersFile);
}

function saveUser(user) {
    const users = getUsers();
    users.push(user);
    writeJSON(usersFile, users);
}

function getGames() {
    return readJSON(gamesFile);
}

function saveGames(games) {
    writeJSON(gamesFile, games);
}

function saveUsers(users) {
    writeJSON(usersFile, users);
}

module.exports = {
    getUsers,
    saveUser,
    getGames,
    saveGames,
    saveUsers
};
