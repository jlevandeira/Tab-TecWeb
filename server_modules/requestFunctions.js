const storage = require('./storage');
const utils = require('./utils');
const gameRules = require('./game_rules');

function register(req, res) {
    if (req.method === 'POST') {
        utils.getRequestBody(req)
            .then(body => {
                const { nick, password } = body;

                if (!nick || !password) {
                    utils.sendResponse(res, 400, { error: 'Nick and password are required' });
                    return;
                }

                const users = storage.getUsers();
                const existingUser = users.find(u => u.nick === nick);

                const hashedPassword = utils.hashPassword(password);

                if (existingUser) {
                    if (existingUser.password === hashedPassword) {
                        utils.sendResponse(res, 200, {}); // Login successful
                    } else {
                        utils.sendResponse(res, 401, { error: 'User registered with a different password' });
                    }
                    return;
                }

                storage.saveUser({
                    nick,
                    password: hashedPassword,
                    victories: 0,
                    games: 0
                });

                utils.sendResponse(res, 200, {});
            })
            .catch(err => {
                utils.sendResponse(res, 500, { error: 'Internal Server Error' });
            });
    } else {
        utils.sendResponse(res, 405, { error: 'Method Not Allowed' });
    }
}

function ranking(req, res) {
    if (req.method === 'POST') {
        utils.getRequestBody(req)
            .then(body => {
                const users = storage.getUsers();
                const sortedUsers = users.sort((a, b) => (b.victories || 0) - (a.victories || 0));
                const top10 = sortedUsers.slice(0, 10).map(u => ({
                    nick: u.nick,
                    victories: u.victories || 0,
                    games: u.games || 0
                }));

                utils.sendResponse(res, 200, { ranking: top10 });
            })
            .catch(err => {
                utils.sendResponse(res, 500, { error: 'Internal Server Error' });
            });
    } else {
        utils.sendResponse(res, 405, { error: 'Method Not Allowed' });
    }
}

const listeners = {};

function notifyListeners(gameId, data) {
    if (listeners[gameId]) {
        listeners[gameId].forEach(res => {
            res.write(`data: ${JSON.stringify(data)}\n\n`);
        });
    }
}

function update(req, res) {
    if (req.method === 'GET') {
        const parsedUrl = require('url').parse(req.url, true);
        const { game: gameId, nick } = parsedUrl.query;

        if (!gameId || !nick) {
            utils.sendResponse(res, 400, { error: 'Game ID and Nick required' });
            return;
        }

        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
        });

        if (!listeners[gameId]) {
            listeners[gameId] = [];
        }
        listeners[gameId].push(res);

        const games = storage.getGames();
        const game = games.find(g => g.id === gameId);
        if (game) {
            res.write(`data: ${JSON.stringify(game)}\n\n`);
        } else {
            res.write(`data: ${JSON.stringify({ error: "Game not found" })}\n\n`);
        }

        req.on('close', () => {
            if (listeners[gameId]) {
                listeners[gameId] = listeners[gameId].filter(r => r !== res);
            }
        });

    } else {
        utils.sendResponse(res, 405, { error: 'Method Not Allowed' });
    }
}


function join(req, res) {
    if (req.method === 'POST') {
        utils.getRequestBody(req)
            .then(body => {
                const { group, nick, password, size } = body;
                const boardSize = parseInt(size);

                if (!group || !nick || !password || isNaN(boardSize)) {
                    utils.sendResponse(res, 400, { error: 'Invalid arguments' });
                    return;
                }
                const users = storage.getUsers();
                const user = users.find(u => u.nick === nick);
                const hashedPassword = utils.hashPassword(password);

                if (!user || user.password !== hashedPassword) {
                    utils.sendResponse(res, 401, { error: 'Invalid credentials' });
                    return;
                }

                const games = storage.getGames();

                let game = games.find(g =>
                    g.group == group &&
                    g.size == boardSize &&
                    Object.keys(g.players).length < 2 &&
                    !g.players[nick] &&
                    g.status === 'waiting'
                );

                if (game) {
                    game.players[nick] = 'blue';
                    if (Object.keys(game.players).length === 2) {
                        game.status = 'playing';
                        game.dice = null;
                        game.step = 'from';
                        game.selected = [];
                        game.selectedIdx = null;
                        const p1 = Object.keys(game.players)[0];
                        game.turn = p1;
                        game.board = gameRules.initBoard(game);
                    }

                    storage.saveGames(games);

                    utils.sendResponse(res, 200, { game: game.id, color: 'blue' });

                    notifyListeners(game.id, {
                        ...game,
                        players: game.players
                    });

                } else {
                    const gameId = utils.generateGameId(group, boardSize);

                    const newGame = {
                        id: gameId,
                        group: group,
                        size: boardSize,
                        players: { [nick]: 'red' },
                        initial: nick,
                        turn: nick,
                        board: [],
                        status: 'waiting'
                    };

                    games.push(newGame);
                    storage.saveGames(games);

                    utils.sendResponse(res, 200, { game: gameId, color: 'red' });
                }
            })
            .catch(err => {
                utils.sendResponse(res, 500, { error: 'Internal Server Error: ' + err.message });
            });
    } else {
        utils.sendResponse(res, 405, { error: 'Method Not Allowed' });
    }
}

function leave(req, res) {
    if (req.method === 'POST') {
        utils.getRequestBody(req)
            .then(body => {
                const { nick, password, game: gameId } = body;

                if (!nick || !password || !gameId) {
                    utils.sendResponse(res, 400, { error: 'Nick, password, and game ID required' });
                    return;
                }

                const users = storage.getUsers();
                const user = users.find(u => u.nick === nick);
                const hashedPassword = utils.hashPassword(password);

                if (!user || user.password !== hashedPassword) {
                    utils.sendResponse(res, 401, { error: 'Invalid credentials' });
                    return;
                }

                const games = storage.getGames();
                const game = games.find(g => g.id === gameId);

                if (!game) {
                    utils.sendResponse(res, 404, { error: 'Game not found' });
                    return;
                }

                const players = Object.keys(game.players);
                if (!players.includes(nick)) {
                    utils.sendResponse(res, 403, { error: 'User not in this game' });
                    return;
                }

                if (game.status === 'waiting') {
                    game.status = 'finished';
                    game.winner = null;

                    storage.saveGames(games);
                    notifyListeners(gameId, { message: "Game canceled by player" });

                    utils.sendResponse(res, 200, {});
                    return;
                }

                if (game.status === 'finished') {
                    utils.sendResponse(res, 200, {});
                    return;
                }
                let winnerNick = null;
                if (players.length > 1) {
                    winnerNick = players.find(p => p !== nick);
                }

                user.games = (user.games || 0) + 1;

                if (winnerNick) {
                    const winner = users.find(u => u.nick === winnerNick);
                    if (winner) {
                        winner.games = (winner.games || 0) + 1;
                        winner.victories = (winner.victories || 0) + 1;
                    }
                }

                // Update game status
                game.status = 'finished';
                game.winner = winnerNick;

                storage.saveGames(games);

                // Notify listeners
                notifyListeners(gameId, { winner: winnerNick, message: "Opponent left" });

                // Save updated users stats
                storage.saveUsers(users);

                utils.sendResponse(res, 200, {});
            })
            .catch(err => {
                utils.sendResponse(res, 500, { error: 'Internal Server Error: ' + err.message });
            });
    } else {
        utils.sendResponse(res, 405, { error: 'Method Not Allowed' });
    }
}

function notify(req, res) {
    if (req.method === 'POST') {
        utils.getRequestBody(req)
            .then(body => {
                const { nick, password, game: gameId, move } = body;
                if (!nick || !password || !gameId || move === undefined) {
                    utils.sendResponse(res, 400, { error: 'Invalid arguments' });
                    return;
                }
                // Verify user
                const users = storage.getUsers();
                const user = users.find(u => u.nick === nick);
                const hashedPassword = utils.hashPassword(password);
                if (!user || user.password !== hashedPassword) {
                    utils.sendResponse(res, 401, { error: 'Invalid credentials' });
                    return;
                }

                // Verify game
                const games = storage.getGames();
                const game = games.find(g => g.id === gameId);
                if (!game) {
                    utils.sendResponse(res, 404, { error: 'Game not found' });
                    return;
                }

                // Check Game Over
                if (game.status !== 'playing') {
                    utils.sendResponse(res, 400, { error: 'Game not active' });
                    return;
                }

                // Execute Move Logic
                const result = gameRules.handleNotify(game, nick, move, game.dice ? game.dice.value : null);

                if (result.error) {
                    utils.sendResponse(res, 400, { error: result.error });
                    return;
                }

                // Update Stats if Winner
                if (result.winner) {
                    const winnerNick = result.winner;
                    const p1Nick = Object.keys(game.players)[0];
                    const p2Nick = Object.keys(game.players)[1];

                    const user1 = users.find(u => u.nick === p1Nick);
                    if (user1) {
                        user1.games = (user1.games || 0) + 1;
                        if (p1Nick === winnerNick) user1.victories = (user1.victories || 0) + 1;
                    }

                    if (p2Nick) {
                        const user2 = users.find(u => u.nick === p2Nick);
                        if (user2) {
                            user2.games = (user2.games || 0) + 1;
                            if (p2Nick === winnerNick) user2.victories = (user2.victories || 0) + 1;
                        }
                    }

                    storage.saveUsers(users);
                }

                // Save Game
                storage.saveGames(games);

                // Notify Listeners
                notifyListeners(gameId, {
                    turn: game.turn,
                    step: game.step,
                    selected: game.selected,
                    pieces: game.board,
                    dice: game.dice,
                    winner: game.winner,
                    players: game.players,
                    initial: game.initial,
                    mustPass: game.mustPass
                });

                utils.sendResponse(res, 200, {});
            })
            .catch(err => {
                utils.sendResponse(res, 500, { error: 'Internal Server Error: ' + err.message });
            });
    } else {
        utils.sendResponse(res, 405, { error: 'Method Not Allowed' });
    }
}

function roll(req, res) {
    if (req.method === 'POST') {
        utils.getRequestBody(req)
            .then(body => {
                const { nick, password, game: gameId } = body;
                if (!nick || !password || !gameId) {
                    utils.sendResponse(res, 400, { error: 'Invalid arguments' });
                    return;
                }

                // Verify user
                const users = storage.getUsers();
                const user = users.find(u => u.nick === nick);
                const hashedPassword = utils.hashPassword(password);
                if (!user || user.password !== hashedPassword) {
                    utils.sendResponse(res, 401, { error: 'Invalid credentials' });
                    return;
                }

                // Verify game
                const games = storage.getGames();
                const game = games.find(g => g.id === gameId);
                if (!game) {
                    utils.sendResponse(res, 404, { error: 'Game not found' });
                    return;
                }

                if (game.turn !== nick) {
                    utils.sendResponse(res, 400, { error: 'Not your turn' });
                    return;
                }

                if (game.status !== 'playing') {
                    utils.sendResponse(res, 400, { error: 'Game not active' });
                    return;
                }

                // Strict Roll Enforcement
                if (!gameRules.canRoll(game, nick)) {
                    utils.sendResponse(res, 400, { error: 'Dice already rolled! Make your move.' });
                    return;
                }

                // Generate Sticks
                let lights = 0;
                const stickValues = [];
                for (let i = 0; i < 4; i++) {
                    const isLight = Math.random() >= 0.5;
                    stickValues.push(isLight);
                    if (isLight) lights++;
                }

                // Map to Rules
                let value, keepPlaying;
                switch (lights) {
                    case 0: value = 6; keepPlaying = true; break;
                    case 1: value = 1; keepPlaying = true; break;
                    case 2: value = 2; keepPlaying = false; break;
                    case 3: value = 3; keepPlaying = false; break;
                    case 4: value = 4; keepPlaying = true; break;
                }

                game.dice = {
                    value,
                    stickValues,
                    keepPlaying
                };

                // Clear previous selection/step just in case
                game.selected = [];
                game.selectedIdx = null;
                game.step = 'from';
                game.mustPass = false; // Reset pass flag for new roll

                // Check for Valid Moves (Auto-Pass Logic)
                const canMove = gameRules.hasValidMoves(game, nick, value);
                if (!canMove) {
                    if (!keepPlaying) {
                        game.mustPass = true;
                    } else {

                    }
                } else {
                    game.mustPass = false;
                }

                storage.saveGames(games);

                notifyListeners(gameId, {
                    turn: game.turn,
                    dice: game.dice,
                    mustPass: game.mustPass,
                    players: game.players,
                    initial: game.initial,
                    message: `Rolled ${value}`
                });

                utils.sendResponse(res, 200, { value, keepPlaying, canMove });
            })
            .catch(err => {
                utils.sendResponse(res, 500, { error: 'Internal Server Error: ' + err.message });
            });
    } else {
        utils.sendResponse(res, 405, { error: 'Method Not Allowed' });
    }
}

function pass(req, res) {
    if (req.method === 'POST') {
        utils.getRequestBody(req)
            .then(body => {
                const { nick, password, game: gameId } = body;
                if (!nick || !password || !gameId) {
                    utils.sendResponse(res, 400, { error: 'Invalid arguments' });
                    return;
                }

                // Verify user
                const users = storage.getUsers();
                const user = users.find(u => u.nick === nick);
                const hashedPassword = utils.hashPassword(password);
                if (!user || user.password !== hashedPassword) {
                    utils.sendResponse(res, 401, { error: 'Invalid credentials' });
                    return;
                }

                // Verify game
                const games = storage.getGames();
                const game = games.find(g => g.id === gameId);
                if (!game) {
                    utils.sendResponse(res, 404, { error: 'Game not found' });
                    return;
                }

                if (game.turn !== nick) {
                    utils.sendResponse(res, 400, { error: 'Not your turn' });
                    return;
                }

                if (game.status !== 'playing') {
                    utils.sendResponse(res, 400, { error: 'Game not active' });
                    return;
                }

                // Switch Turn
                const players = Object.keys(game.players);
                const nextPlayer = players.find(p => p !== nick);
                if (!nextPlayer) {
                    // Single player??
                    utils.sendResponse(res, 400, { error: 'No opponent found' });
                    return;
                }

                game.turn = nextPlayer;
                game.dice = null; // Clear dice
                game.mustPass = false; // Reset pass flag
                game.step = null;
                game.selected = [];
                game.selectedIdx = null;

                storage.saveGames(games);

                notifyListeners(gameId, {
                    turn: game.turn,
                    dice: null,
                    step: 'from',
                    selected: [],
                    pieces: game.board,
                    players: game.players,
                    initial: game.initial,
                    mustPass: false,
                    message: `Turn passed to ${nextPlayer}`
                });

                utils.sendResponse(res, 200, { success: true });
            })
            .catch(err => {
                utils.sendResponse(res, 500, { error: 'Internal Server Error: ' + err.message });
            });
    } else {
        utils.sendResponse(res, 405, { error: 'Method Not Allowed' });
    }
}

module.exports = {
    register,
    ranking,
    join,
    update,
    leave,
    notify,
    roll,
    pass
};
