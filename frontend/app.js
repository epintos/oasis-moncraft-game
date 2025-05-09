const ws = new WebSocket('ws://localhost:8080');

let playerStep = 0;
let sessionCode = '';

ws.onopen = () => {
  document.getElementById('output').textContent = 'Connected to WebSocket server';
};

ws.onmessage = (event) => {
  try {
    const data = JSON.parse(event.data);
    document.getElementById('output').textContent = JSON.stringify(data, null, 2);

    if (data.type === 'startGameResult' && data.success) {
      sessionCode = data.sessionCode;
      playerStep = 0;
      document.getElementById('sessionCode').value = sessionCode;
    }

    if (data.type === 'loadGameResult' && data.success) {
      sessionCode = data.sessionCode;
      playerStep = data.currentStep || 0;
      document.getElementById('sessionCode').value = sessionCode;
    }

    if (data.type === 'saveGameResult' && data.success) {
        console.log(`Game saved at step ${playerStep}`);
      }

  } catch (error) {
    document.getElementById('output').textContent = 'Error parsing response';
  }
};

ws.onclose = () => {
  document.getElementById('output').textContent = 'Disconnected from WebSocket server';
};

ws.onerror = (error) => {
  document.getElementById('output').textContent = `WebSocket error: ${error.message || 'Unknown error'}`;
};

function sendTransaction() {
  const toAddress = document.getElementById('toAddress').value.trim();
  const amount = document.getElementById('amount').value.trim();

  if (!toAddress || !amount) {
    document.getElementById('output').textContent = 'Please enter address and amount';
    return;
  }

  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'sendNativeToken',
      toAddress,
      amount,
    }));
  } else {
    document.getElementById('output').textContent = 'WebSocket is not connected';
  }
}

function startSession() {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'startGame' }));
  } else {
    document.getElementById('output').textContent = 'WebSocket is not connected';
  }
}

function loadGame() {
  const inputCode = document.getElementById('sessionCode').value.trim();
  if (!inputCode) {
    document.getElementById('output').textContent = 'Please enter a session code to load';
    return;
  }

  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'loadGame',
      sessionCode: inputCode
    }));
  } else {
    document.getElementById('output').textContent = 'WebSocket is not connected';
  }
}

function move() {
  if (!sessionCode) {
    document.getElementById('output').textContent = 'Please start or load a session first';
    return;
  }

  if (ws.readyState === WebSocket.OPEN) {
    const request = {
      type: 'checkStep',
      sessionCode,
      playerStep: playerStep++
    };
    ws.send(JSON.stringify(request));
  } else {
    document.getElementById('output').textContent = 'WebSocket is not connected';
  }
}

function saveGame() {
    if (!sessionCode) {
      document.getElementById('output').textContent = 'No session to save';
      return;
    }
  
    if (ws.readyState === WebSocket.OPEN) {
      const request = {
        type: 'saveGame',
        sessionCode,
        currentStep: playerStep,
      };
      ws.send(JSON.stringify(request));
    } else {
      document.getElementById('output').textContent = 'WebSocket is not connected';
    }
}






const gridSize = 5;
let playerX = 0;
let playerY = 0;

function createGrid() {
  const grid = document.getElementById('grid');
  grid.innerHTML = '';
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const cell = document.createElement('div');
      cell.classList.add('cell');
      if (x === playerX && y === playerY) {
        cell.classList.add('player');
      }
      grid.appendChild(cell);
    }
  }
}

function handleArrowPress(event) {
  let moved = false;
  if (event.key === 'ArrowUp' && playerY > 0) {
    playerY--;
    moved = true;
  } else if (event.key === 'ArrowDown' && playerY < gridSize - 1) {
    playerY++;
    moved = true;
  } else if (event.key === 'ArrowLeft' && playerX > 0) {
    playerX--;
    moved = true;
  } else if (event.key === 'ArrowRight' && playerX < gridSize - 1) {
    playerX++;
    moved = true;
  }

  if (moved) {
    createGrid();
    move();
  }
}

document.addEventListener('keydown', handleArrowPress);
createGrid();
