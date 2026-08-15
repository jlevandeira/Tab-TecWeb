(function (global) {
  if (!global.Network) {
    console.warn("Network não encontrado. Carrega network.js antes de onlineAdapter.js");
  }
  const Network = global.Network;

  const adapter = {
    isOnline: false,
    myNick: null,
    myPassword: null,
    group: null,
    gameId: null,
    mappingMode: 'gamelogic',
    saved: {},
    serverState: null
  };

  // Helpers to map 1D index to 2D board coordinates
  function indexToCoordsByGamelogic(index, cols, initialIsMe) {
    const gl = window.gameController && window.gameController.gameLogic;
    if (!gl) return null;
    if (initialIsMe) {
      return gl.coordenadasHuman(index, cols);
    } else {
      return gl.coordenadas(index, cols);
    }
  }

  function coordsToIndexByGamelogic(row, col, cols, initialIsMe) {
    const gl = window.gameController && window.gameController.gameLogic;
    if (!gl) return -1;
    if (initialIsMe) {
      return gl.positionHuman(row, col, cols);
    } else {
      return gl.position(row, col, cols);
    }
  }

  function indexToCoordsByServer(index, cols, initialIsMe) {
    const coordsList = [];
    const humanRows = [3, 2, 1, 0];
    for (let hr = 0; hr < 4; hr++) {
      const r = humanRows[hr];
      const rowIndex = hr;
      const goRightToLeft = (rowIndex % 2 === 0);
      if (goRightToLeft) {
        for (let c = cols - 1; c >= 0; c--) coordsList.push({ row: r, col: c });
      } else {
        for (let c = 0; c < cols; c++) coordsList.push({ row: r, col: c });
      }
    }
    if (index < 0 || index >= coordsList.length) return null;
    if (index < 0 || index >= coordsList.length) return null;
    return coordsList[index];
  }

  function coordsToIndexByServer(row, col, cols, initialIsMe) {
    const coordsList = [];
    const humanRows = [3, 2, 1, 0];
    for (let hr = 0; hr < 4; hr++) {
      const r = humanRows[hr];
      const goRightToLeft = (hr % 2 === 0);
      if (goRightToLeft) {
        for (let c = cols - 1; c >= 0; c--) coordsList.push({ row: r, col: c });
      } else {
        for (let c = 0; c < cols; c++) coordsList.push({ row: r, col: c });
      }
    }

    // normal lookup
    for (let i = 0; i < coordsList.length; i++) {
      if (coordsList[i].row === row && coordsList[i].col === col) return i;
    }
    return -1;
  }

  function indexToCoords(index, cols, initialIsMe) {
    if (adapter.mappingMode === 'gamelogic') return indexToCoordsByGamelogic(index, cols, initialIsMe);
    return indexToCoordsByServer(index, cols, initialIsMe);
  }

  function coordsToIndex(row, col, cols, initialIsMe) {
    if (adapter.mappingMode === 'gamelogic') return coordsToIndexByGamelogic(row, col, cols, initialIsMe);
    return coordsToIndexByServer(row, col, cols, initialIsMe);
  }

  // Rebuild local board from server update
  function syncFromServer(data) {
    const gc = window.gameController;
    if (!gc || !gc.board) {
      console.warn("GameController não encontrado", gc);
      return;
    }

    adapter.serverState = Object.assign({}, adapter.serverState || {}, data);

    const size = (data.pieces && data.pieces.length) / 4 || gc.board.columns;
    const cols = size;
    if (gc.board.columns !== cols || gc.board.rows !== 4) {
      gc.board.generateBoard(cols);
    } else {
      gc.board.initializeBoard();
      gc.board.piecesH = [];
      gc.board.piecesC = [];
    }

    const playersMap = data.players || {};
    const myColor = playersMap[adapter.myNick];

    if (!data.pieces || !Array.isArray(data.pieces)) {
    } else {
      // Map each piece from server.pieces into local Piece instances
      (data.pieces || []).forEach((cellObj, idx) => {
        if (!cellObj) return;
        const coords = indexToCoords(idx, cols, data.initial === adapter.myNick);
        if (!coords) {
          return;
        }

        const { row, col } = coords;
        const ownerColor = cellObj.color;
        let ownerIsMe = false;

        if (myColor) {
          ownerIsMe = (ownerColor === myColor);
        } else {
          if (idx >= 0 && idx < cols) {
            ownerIsMe = (data.initial === adapter.myNick);
          } else if (idx >= 3 * cols && idx < 4 * cols) {
            ownerIsMe = (data.initial !== adapter.myNick);
          } else {
            ownerIsMe = false;
          }
        }

        const pid = ownerIsMe ? `human_srv_${idx}` : `computer_srv_${idx}`;
        const piece = new window.Piece(ownerIsMe ? 'human' : 'computer', pid);
        piece.hasMoved = (typeof cellObj.hasMoved !== 'undefined') ? cellObj.hasMoved : !!cellObj.inMotion;
        piece.hasEnteredOpponentLine = (typeof cellObj.hasEnteredOpponentLine !== 'undefined') ? cellObj.hasEnteredOpponentLine : !!cellObj.reachedLastRow;
        piece.row = row;
        piece.col = col;
        piece.updateState();
        gc.board.board[row][col] = piece;

        if (ownerIsMe) gc.board.piecesH.push(piece);
        else gc.board.piecesC.push(piece);
      });

      gc.board.clearAllPieces();
      gc.board.renderAll();
    }

    // Updating states
    if (data.turn) {
      gc.currentPlayer = (data.turn === adapter.myNick) ? 'human' : 'computer';
    }
    // Update mustPass flag
    if (typeof data.mustPass !== 'undefined') {
      gc.mustPass = data.mustPass;
      // Also force check turn pass UI if needed
      if (gc.checkTurnPass) gc.checkTurnPass();
    }

    if (data.dice) {
      gc.diceRolled = true;
      gc.diceResult = { valor: parseInt(data.dice.value), nome: '', repete: data.dice.keepPlaying ? "Sim" : "Não", stickValues: data.dice.stickValues };
      gc.repeatTurn = !!data.dice.keepPlaying;
      gc.repeatTurn = !!data.dice.keepPlaying;

      try {
        if (gc.dice && gc.dice.rollToValue) {
          gc.dice.rollToValue(data.dice.value);
        } else {
          const diceRes = document.getElementById('dice-res');
          const diceNumber = document.getElementById('dice-number');
          const diceRepeat = document.getElementById('dice-repeat');

          if (diceRes) diceRes.innerHTML = `<strong>Nome: </strong>${gc.diceResult.nome || '-'}`;
          if (diceNumber) diceNumber.innerHTML = `<strong>Número de casas: </strong>${gc.diceResult.valor || '-'}`;
          if (diceRepeat) diceRepeat.innerHTML = `<strong>Repete: </strong>${gc.diceResult.repete || '-'}`;
        }
      } catch (e) { console.error("Dice anim error", e); }
    } else {
      gc.diceRolled = false;
      gc.diceResult = null;
      gc.repeatTurn = false;

      try {
        document.getElementById('dice-res').innerHTML = '<strong>Nome: </strong>-';
        document.getElementById('dice-number').innerHTML = '<strong>Número de casas: </strong>-';
        document.getElementById('dice-repeat').innerHTML = '<strong>Repete: </strong>-';
      } catch (e) { }
    }

    // mustPass
    gc.mustPass = !!data.mustPass;
    // Auto-Pass Logic
    if (gc.mustPass && data.turn === adapter.myNick) {
      setTimeout(() => {
        if (adapter.isOnline) {
          Network.passTurn({ nick: adapter.myNick, password: adapter.myPassword, game: adapter.gameId })
            .catch(err => console.error("Auto-pass error:", err));
        }
      }, 2000);
    }

    document.querySelectorAll('.board-cell.selected').forEach(c => c.classList.remove('selected'));
    document.querySelectorAll('.board-cell.possible').forEach(c => c.classList.remove('possible'));

    if (adapter.selectedIdx !== null && data.step === 'to') {
      const coords = indexToCoords(adapter.selectedIdx, cols, data.initial === adapter.myNick);
      if (coords) {
        const cell = document.querySelector(`[data-row="${coords.row}"][data-col="${coords.col}"]`);
        if (cell) cell.classList.add('selected');
      }
    } else if (data.step !== 'to') {
      adapter.selectedIdx = null;
    }

    if (Array.isArray(data.selected)) {
      if (data.step !== 'from') {
        data.selected.forEach(idx => {
          const coords = indexToCoords(idx, cols, data.initial === adapter.myNick);
          if (!coords) return;
          const cell = document.querySelector(`[data-row="${coords.row}"][data-col="${coords.col}"]`);
          if (cell) cell.classList.add('possible');
        });
      }
    }
    let turnMsg = "";
    const numPlayers = Object.keys(data.players || {}).length;

    if (numPlayers < 2) {
      turnMsg = "Aguardando adversário... ";
    } else if (data.turn === adapter.myNick) {
      turnMsg = "SUA VEZ! ";
    } else {
      turnMsg = `Vez de ${data.turn}: `;
    }

    let actionMsg = "";
    if (numPlayers < 2) {
      actionMsg = ""; // Suppress action message if waiting
    } else if (gc.mustPass && data.turn === adapter.myNick) {
      actionMsg = "Sem jogadas. A passar a vez automaticamente...";
    } else if (!data.dice) {
      actionMsg = "Lance os dados!";
    } else if (data.step) {
      if (data.step === 'from') actionMsg = "Escolha uma peça para mover";

      else if (data.step === 'to') actionMsg = "Escolha o destino";

      else if (data.step === 'take') actionMsg = "Escolha uma peça para capturar";

      else actionMsg = data.step;
    } else {
      actionMsg = "Faça a jogada";
    }

    if (data.dice && data.dice.keepPlaying && gc.hasValidMoves && !gc.hasValidMoves()) {
      actionMsg = `Saiu ${data.dice.value}. Não tem movimentos válidos, pode lançar de novo!`;
    }

    gc.updateMessage(`${turnMsg}${actionMsg}`);

    if (data.winner) {
      const winnerNick = data.winner;
      const msg = (winnerNick === adapter.myNick) ? "Venceu!" : (`Venceu: ${winnerNick}`);
      gc.updateMessage(msg);
      gc.gameState = 'finished';
      gc.updateButtons && gc.updateButtons();
      Network.stopUpdateListener();
      adapter.isOnline = false;

      // Force leave to make sure the server registers the end of the game
      Network.leave({ nick: adapter.myNick, password: adapter.myPassword, game: adapter.gameId })
        .catch(err => {
          if (err.message && err.message.includes("Not a valid game")) return;
          console.log("Auto-leave error (final):", err);
        });

      // Restore local behavior
      restorePatchedFunctions();
    }
  }

  function restorePatchedFunctions() {
    const gc = window.gameController;
    if (!gc) return;
    // Restore dice
    try {
      if (adapter.saved.diceRoll) gc.dice.rollSticks = adapter.saved.diceRoll;
    } catch (e) { }
    // Restore clicks
    try {
      if (adapter.saved.onPieceClick) gc.onPieceClick = adapter.saved.onPieceClick;
      if (adapter.saved.onCellClick) gc.onCellClick = adapter.saved.onCellClick;
    } catch (e) { }
  }

  function patchFunctions() {
    const gc = window.gameController;
    if (!gc) return;
    // Save original functions
    adapter.saved.diceRoll = gc.dice.rollSticks.bind(gc.dice);
    adapter.saved.onPieceClick = gc.onPieceClick.bind(gc);
    adapter.saved.onCellClick = gc.onCellClick.bind(gc);

    // Replace dice.rollSticks
    gc.dice.rollSticks = function () {

      if (!adapter.isOnline) return adapter.saved.diceRoll();
      const serverState = adapter.serverState;
      if (!serverState) {
        gc.updateMessage && gc.updateMessage("Aguardando ligação ao servidor...");
        return;
      }
      if (serverState.turn !== adapter.myNick) {
        gc.updateMessage && gc.updateMessage("Não é a sua vez (online).");
        return;
      }
      // Send roll request to server
      Network.roll({ nick: adapter.myNick, password: adapter.myPassword, game: adapter.gameId })
        .catch(err => {
          console.error("Roll error:", err);
          gc.updateMessage && gc.updateMessage("Error requesting roll: " + (err.message || err));
        });
    };

    gc.onPieceClick = function (element) {
      if (!adapter.isOnline) return adapter.saved.onPieceClick(element);
      const cell = element.parentElement;
      if (!cell) return;
      const row = parseInt(cell.dataset.row);
      const col = parseInt(cell.dataset.col);
      const cols = gc.board.columns;
      const initialIsMe = (adapter.serverState && adapter.serverState.initial === adapter.myNick);
      const idx = coordsToIndex(row, col, cols, initialIsMe);

      if (idx < 0 || idx === undefined || idx === null) {
        gc.updateMessage("Não foi possível converter posição para servidor.");
        return;
      }

      adapter.selectedIdx = idx;

      Network.notify({ nick: adapter.myNick, password: adapter.myPassword, game: adapter.gameId, move: idx })
        .catch(err => {
          console.error("Notify error:", err);
          gc.updateMessage && gc.updateMessage("Jogada rejeitada: " + (err.message || err));
        });
    };

    gc.onCellClick = function (cell) {
      if (!adapter.isOnline) return adapter.saved.onCellClick(cell);
      const row = parseInt(cell.dataset.row);
      const col = parseInt(cell.dataset.col);
      const cols = gc.board.columns;
      const initialIsMe = (adapter.serverState && adapter.serverState.initial === adapter.myNick);
      const idx = coordsToIndex(row, col, cols, initialIsMe);
      if (idx < 0) {
        gc.updateMessage("Não foi possível converter posição para servidor.");
        return;
      }

      Network.notify({ nick: adapter.myNick, password: adapter.myPassword, game: adapter.gameId, move: idx })
        .catch(err => {
          console.error("Notify error:", err);
          gc.updateMessage && gc.updateMessage("Jogada rejeitada: " + (err.message || err));
        });
    };
  }

  // API pública:
  function startOnline({ group, nick, password, size }, onStarted) {
    const gc = window.gameController;
    if (!gc) {
      return Promise.reject(new Error("gameController não encontrado. Certifica-te que main.js foi carregado."));
    }
    adapter.isOnline = true;
    adapter.myNick = nick;
    adapter.myPassword = password;
    adapter.group = group;

    // 1) Fazer join
    return Network.join({ group, nick, password, size })
      .then(resp => {
        adapter.gameId = resp.game || resp.gameId || resp.game || resp;
        console.log(`[DEBUG] Joined Game! Resp: ${JSON.stringify(resp)} | GameID: ${adapter.gameId}`);
        // 2) Patchar funções locais para comportamento online
        patchFunctions();
        // 3) Iniciar EventSource /update
        Network.startUpdateListener({ game: adapter.gameId, nick: adapter.myNick }, function (data) {
          try {
            syncFromServer(data);
            onStarted && onStarted(null, data);
          } catch (e) {
            console.error("Erro a processar update SSE:", e);
          }
        }, function (err) {
          console.warn("SSE erro:", err);
        });
        return resp;
      })
      .catch(err => {
        // Reverter isOnline se falha
        adapter.isOnline = false;
        throw err;
      });
  }

  function stopOnline() {
    adapter.isOnline = false;
    adapter.serverState = null;
    // fechar listener
    Network.stopUpdateListener();
    // restaurar funcoes
    restorePatchedFunctions();
  }

  // Expor
  adapter.startOnline = startOnline;
  adapter.stopOnline = stopOnline;

  global.OnlineAdapter = adapter;
})(window);