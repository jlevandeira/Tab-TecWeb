class GameRules {
    constructor() {
        this.rows = 4;
    }

    // Convert 1D index to {row, col}
    coordenadas(pos, cols) {
        if (pos < 0) return null;
        const row = Math.floor(pos / cols);
        if (row >= 4) return null;

        const posInRow = pos % cols;
        let col;

        if (row === 0 || row === 2) {
            col = cols - 1 - posInRow;
        } else {
            col = posInRow;
        }

        return { row, col };
    }

    // Convert {row, col} to 1D index
    position(row, col, cols) {
        if (row < 0 || row >= 4 || col < 0 || col >= cols) return -1;
        let pos;
        if (row === 0 || row === 2) {
            pos = row * cols + (cols - 1 - col);
        } else {
            pos = row * cols + col;
        }
        return pos;
    }

    // Helper to get piece from board
    getPieceAt(board, row, col, cols) {
        const idx = this.position(row, col, cols);
        if (idx < 0 || idx >= board.length) return null;
        return board[idx];
    }

    // Get next position based on dice value
    nextPos(piece, value, cols) {
        let currentPos;
        const isP2 = (piece.player === 'p2' || piece.player === 'blue');
        let pos;

        if (piece.player === 'blue') {
            pos = this.positionHuman(piece.row, piece.col, cols);
        } else {
            pos = this.position(piece.row, piece.col, cols);
        }

        if (pos === -1) return null;

        const newPosIdx = pos + value;

        let result;
        if (piece.player === 'blue') {
            result = this.coordenadasHuman(newPosIdx, cols);
        } else {
            result = this.coordenadas(newPosIdx, cols);
        }

        return result;
    }

    // Helper: Position Human (same as gamelogic.js)
    positionHuman(row, col, cols) {
        if (row < 0 || row >= 4 || col < 0 || col >= cols) return -1;
        const humanRow = 3 - row;
        let pos;

        if (humanRow % 2 === 1) {
            pos = humanRow * cols + (cols - 1 - col);
        } else {
            pos = humanRow * cols + col;
        }
        return pos;
    }

    // Helper: Coordenadas Human
    coordenadasHuman(pos, cols) {
        if (pos < 0) return null;
        const humanRow = Math.floor(pos / cols);
        if (humanRow >= 4) return null;

        const posInRow = pos % cols;
        const realRow = 3 - humanRow;
        let col;

        if (humanRow % 2 === 1) {
            col = cols - 1 - posInRow;
        } else {
            col = posInRow;
        }
        return { row: realRow, col };
    }

    // Initialize board with pieces
    initBoard(game) {
        const board = new Array(4 * game.size).fill(null);

        const p1 = Object.keys(game.players)[0];
        const p2 = Object.keys(game.players)[1];

        for (let i = 0; i < game.size; i++) {
            const piece = {
                id: `p1_${i}`,
                player: 'red',
                color: 'red',
                row: 0,
                col: i,
                state: 'not-moved',
                hasMoved: false,
                hasEnteredOpponentLine: false
            };
            const idx = this.position(0, i, game.size);
            board[idx] = piece;
        }

        if (Object.keys(game.players).length > 1) {
            for (let i = 0; i < game.size; i++) {
                const piece = {
                    id: `p2_${i}`,
                    player: 'blue',
                    color: 'blue',
                    row: 3,
                    col: i,
                    state: 'not-moved',
                    hasMoved: false,
                    hasEnteredOpponentLine: false
                };
                const idx = this.position(3, i, game.size);
                board[idx] = piece;
            }
        }

        return board;
    }

    // Check if player can roll dice
    canRoll(game, nick) {
        if (!game.dice) return true;

        if (game.dice.keepPlaying) {
            const hasMoves = this.hasValidMoves(game, nick, game.dice.value);
            if (!hasMoves) return true;
        }

        return false;
    }

    // Check if player has any valid moves
    hasValidMoves(game, nick, value) {
        // Map nick to color using game.players
        const color = game.players[nick];
        if (!color) return false; // Should not happen

        const cols = game.size;

        // Find all pieces for this color
        const pieces = game.board.filter(p => p && p.color === color);

        // Check if ANY piece has valid moves
        for (const p of pieces) {
            const possibleMoves = this.getAllNextPos(game, p, value);
            if (possibleMoves.length > 0) return true;
        }
        return false;
    }

    // Get all valid next positions (indices) for a piece
    getAllNextPos(game, piece, value) {
        // Ported strict logic from gamelogic.js
        const cols = game.size;

        // Rule: Pieces in 'not-moved' state can only leave with 1
        if (piece.state === 'not-moved') {
            if (value !== 1) {
                return [];
            }
        }

        // Rule: Veteran pieces (entered opponent line) cannot move if any friendly piece is still in INITIAL LINE
        if (piece.hasEnteredOpponentLine) {
            const initialRow = (piece.color === 'red') ? 0 : 3;
            const hasFrozenPieces = game.board.some(p => p && p.color === piece.color && p.row === initialRow);
            if (hasFrozenPieces) {
                return [];
            }
        }

        const positions = [];
        const isHumanLogic = (piece.player === 'blue');
        const isComputerLogic = (piece.player === 'red');
        const canChoose = (isHumanLogic && piece.row === 1) || (isComputerLogic && piece.row === 2);

        if (!canChoose) {
            // No branching choice
            if (piece.row === 0) {
                const willLeave = (piece.col - value) < 0;
                if (!willLeave) {
                    const normalMove = this.nextPos(piece, value, cols);
                    if (normalMove) positions.push(this.position(normalMove.row, normalMove.col, cols));
                    return positions;
                }

                const casasProx = value - (piece.col + 1);
                // "colL2 = casasProx"
                const colL2 = casasProx;
                if (colL2 >= 0 && colL2 < cols) {
                    // target: row 1, col colL2
                    positions.push(this.position(1, colL2, cols));
                }
                return positions;

            } else if (piece.row === 3) {
                const willLeave = (piece.col + value) >= cols;
                if (!willLeave) {
                    const normalMove = this.nextPos(piece, value, cols);
                    if (normalMove) positions.push(this.position(normalMove.row, normalMove.col, cols));
                    return positions;
                }

                const casasProx = value - (cols - piece.col);
                // "colL3 = cols - 1 - casasProx"
                const colL3 = cols - 1 - casasProx;
                if (colL3 >= 0 && colL3 < cols) {
                    positions.push(this.position(2, colL3, cols));
                }
                return positions;
            }

            // Normal move (Row 1 or 2 but not switching point yet?)
            // Or Rows that just track blindly.
            const normalMove = this.nextPos(piece, value, cols);
            if (normalMove) positions.push(this.position(normalMove.row, normalMove.col, cols));
            return positions;
        }

        // Branching Logic
        let leaveRow = false;

        if (piece.row === 1 || piece.row === 3) {
            leaveRow = (piece.col + value >= cols);
        } else {
            leaveRow = (piece.col - value < 0);
        }

        if (!leaveRow) {
            const normalMove = this.nextPos(piece, value, cols);
            if (normalMove) positions.push(this.position(normalMove.row, normalMove.col, cols));
            return positions;
        }

        // Leaving Row Logic (Branching)
        let casasProx;
        if (piece.row === 1) { // Left->Right leaving
            casasProx = value - (cols - piece.col);
        } else { // Row 2: Right->Left leaving
            casasProx = value - (piece.col + 1);
        }

        if (isHumanLogic) {
            const colL1 = cols - 1 - casasProx;
            if (colL1 >= 0 && colL1 < cols) {
                positions.push(this.position(0, colL1, cols));
            }

            const colL3 = cols - 1 - casasProx;
            if (colL3 >= 0 && colL3 < cols) {
                positions.push(this.position(2, colL3, cols));
            }

        } else {
            const colL2 = casasProx;
            if (colL2 >= 0 && colL2 < cols) {
                positions.push(this.position(1, colL2, cols));
            }

            const colL4 = casasProx;
            if (colL4 >= 0 && colL4 < cols) {
                positions.push(this.position(3, colL4, cols));
            }
        }

        let finalPositions = positions.filter(pos => pos !== -1);

        // Rule: Cannot capture own pieces
        finalPositions = finalPositions.filter(pos => {
            const targetPiece = game.board[pos];
            return !(targetPiece && targetPiece.color === piece.color);
        });

        // Rule: Veteran pieces that have left the opponent's initial line cannot return to it
        const lastRow = (piece.color === 'red') ? 3 : 0;
        if (piece.hasEnteredOpponentLine && piece.row !== lastRow) {
            finalPositions = finalPositions.filter(pos => {
                const coords = this.coordenadas(pos, cols);
                return coords.row !== lastRow;
            });
        }

        return finalPositions;
    }

    // Main Handler
    handleNotify(game, nick, moveIdx, diceValue) {
        if (!game.board) game.board = this.initBoard(game);

        const pColor = game.players[nick];
        if (!pColor) return { error: "Player color not found" };

        // Validations
        if (game.turn !== nick) return { error: "Not your turn" };
        if (game.mustPass) return { error: "Turn ended. You must pass." }; // BLOCK moves if turn over
        if (!diceValue) return { error: "Roll dice first" };

        let step = game.step || 'from';

        // Step 1: Select Piece
        if (step === 'from') {
            // moveIdx is the 1D index of the piece clicked
            const p = game.board[moveIdx];

            if (!p) return { error: "Empty cell" };
            if (p.color !== pColor) return { error: "Not your piece" };

            // Calculate valid moves for this piece
            const targets = this.getAllNextPos(game, p, diceValue);

            if (targets.length === 0) return { error: "No valid moves for this piece" };

            // Valid selection
            game.selectedIdx = moveIdx;
            game.selected = targets; // Send possible moves to client
            game.step = 'to';
            return { success: true };
        }

        // Step 2: Select Target
        if (step === 'to') {
            // moveIdx is now the TOPIC `move` which for 'to' step is the TARGET index
            const targetIdx = moveIdx;

            // Validate target is in previously calculated 'selected' list
            if (!game.selected || !game.selected.includes(targetIdx)) {
                // If user clicks same piece, deselect.
                if (targetIdx === game.selectedIdx) {
                    game.step = 'from';
                    game.selectedIdx = null;
                    game.selected = [];
                    return { success: true, message: "Deselected" };
                }
                return { error: "Invalid move target" };
            }

            // Execute Move
            const sourceIdx = game.selectedIdx;
            const piece = game.board[sourceIdx];
            const targetPiece = game.board[targetIdx];

            // Capture
            if (targetPiece) {
                // Friendly Fire Check (Redundant safety)
                if (targetPiece.color === piece.color) {
                    return { error: "Cannot capture your own piece" };
                }
                // Opponent piece captured
                // No explicit remove needed as we overwrite, but might want to log?
            }

            // Update Board
            game.board[targetIdx] = piece;
            game.board[sourceIdx] = null;

            // Update Piece Stats
            const coords = this.coordenadas(targetIdx, game.size);
            piece.row = coords.row;
            piece.col = coords.col;
            piece.hasMoved = true;

            // Logic to update state (in-play vs veteran)
            const lastRow = (piece.color === 'red') ? 3 : 0;
            if (piece.row === lastRow) {
                piece.hasEnteredOpponentLine = true;
            }
            piece.state = piece.hasEnteredOpponentLine ? 'veteran' : 'in-play';

            // Win Condition Check
            // Count pieces
            let redCount = 0;
            let blueCount = 0;
            for (const p of game.board) {
                if (p) {
                    if (p.color === 'red') redCount++;
                    else if (p.color === 'blue') blueCount++;
                }
            }

            if (redCount === 0) {
                game.winner = Object.keys(game.players).find(nick => game.players[nick] === 'blue');
                game.status = 'finished';
                return { success: true, moved: true, winner: game.winner };
            }
            if (blueCount === 0) {
                game.winner = Object.keys(game.players).find(nick => game.players[nick] === 'red');
                game.status = 'finished';
                return { success: true, moved: true, winner: game.winner };
            }

            // Turn Flow Logic
            // If dice says keepPlaying (Sim), clear dice to allow new roll.
            // If dice says don't repeat (Não), set mustPass = true.
            if (game.dice && game.dice.keepPlaying) {
                game.dice = null; // Prepare for next roll
                // game.turn stays same
            } else {
                game.mustPass = true;
                // Client should see this and call /pass
            }

            // Reset Step to 'from' (for next turn/roll)
            game.step = 'from';
            game.selected = [];
            game.selectedIdx = null;

            return { success: true, moved: true };
        }
    }
}

module.exports = new GameRules();
