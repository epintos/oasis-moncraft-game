const apiUrl = 'http://localhost:8080'; // For local testing
// const apiUrl = 'http://84.255.245.194:5100'; // For production

let playerStep = 0;
let sessionCode = '';
let sessionId = null; // Store sessionId for joinFight
let isBusy = false;

const spinner = document.getElementById('spinner');
const output = document.getElementById('output');

function logBusy(context) {
  console.log(`[isBusy] ${context}:`, isBusy);
}

function showSpinner() {
  spinner.classList.add('show');
}

function hideSpinner() {
  spinner.classList.remove('show');
}

async function apiRequest(endpoint, data) {
  showSpinner();
  isBusy = true;
  logBusy(`Sending ${endpoint} request`);
  try {
    const response = await fetch(`${apiUrl}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await response.json();
    output.textContent = JSON.stringify(result, null, 2);
    return result;
  } catch (error) {
    output.textContent = `Error: ${error.message || 'Network error'}`;
    return { type: 'error', message: error.message || 'Network error' };
  } finally {
    hideSpinner();
    isBusy = false;
    logBusy(`Completed ${endpoint} request`);
  }
}

async function startSession() {
  if (isBusy) return;
  const data = await apiRequest('/startGame', { type: 'startGame' });
  if (data.type === 'startGameResult' && data.success) {
    sessionCode = data.sessionCode;
    sessionId = data.sessionId;
    playerStep = 0;
    document.getElementById('sessionCode').value = sessionCode;
    await loadGame(); // Load game to get initial state
  }
}

async function loadGame() {
  if (isBusy) return;
  const inputCode = document.getElementById('sessionCode').value.trim();
  if (!inputCode) {
    output.textContent = 'Please enter a session code to load';
    return;
  }
  const data = await apiRequest('/loadGame', { sessionCode: inputCode });
  if (data.type === 'loadGameResult' && data.success) {
    sessionCode = data.sessionCode;
    sessionId = data.sessionId;
    playerStep = data.currentStep || 0;
    document.getElementById('sessionCode').value = sessionCode;
    renderMonsterList(data.monsters || []);
  }
}

async function move() {
  if (!sessionCode) {
    output.textContent = 'Please start or load a session first';
    return;
  }
  const data = await apiRequest('/checkStep', { sessionCode, playerStep: playerStep++ });
  if (data.type === 'checkStepResult' && data.hasAppeared) {
    isBusy = true;
    const confirmed = confirm(`A wild monster appeared (index ${data.monsterIndex})! Try to capture it?`);
    if (confirmed) {
      await apiRequest('/captureMonster', {
        sessionCode,
        monsterIndex: parseInt(data.monsterIndex),
        currentStep: playerStep,
      }).then(async (captureData) => {
        if (captureData.type === 'captureMonsterResult' && captureData.success) {
          alert(captureData.message);
          await loadGame(); // Refresh monster list
        }
      });
    }
    isBusy = false;
  }
}

async function saveGame() {
  if (!sessionCode) {
    output.textContent = 'No session to save';
    return;
  }
  if (isBusy) return;
  const data = await apiRequest('/saveGame', { sessionCode, currentStep: playerStep });
  if (data.type === 'saveGameResult' && data.success) {
    console.log(`Game saved at step ${playerStep}`);
  }
}

async function joinSelectedMonsterToFight(fightId, tokenId) {
  if (!sessionCode) {
    output.textContent = 'No session active';
    return;
  }
  if (isBusy) return;
  const data = await apiRequest('/joinFight', {
    sessionCode,
    sessionId,
    tokenId: parseInt(tokenId),
    fightId: parseInt(fightId),
  });
  if (data.type === 'joinFightResult') {
    if (data.success) {
      if (data.status === '2') {
        alert(data.won ? '🎉 You won the fight!' : 'You lost the fight.');
      } else {
        alert('You joined the fight.');
      }
      await loadGame(); // Refresh state
    } else {
      alert(`Failed to join fight: ${data.message}`);
    }
  }
}

function renderMonsterList(monsters) {
  const list = document.getElementById('monsterList');
  list.innerHTML = '';

  if (!monsters || monsters.length === 0) {
    list.innerHTML = '<li>None</li>';
    return;
  }

  monsters.forEach((monster) => {
    const li = document.createElement('li');
    li.className = 'monster-entry';

    const img = document.createElement('img');
    img.src = `https://ipfs.io/ipfs/${monster.uri.replace('ipfs://', '')}`;
    img.alt = monster.name;

    const info = document.createElement('div');
    info.className = 'monster-info';

    const name = document.createElement('div');
    name.className = 'monster-name';
    name.textContent = `#${monster.tokenId} - ${monster.name}`;

    const actions = document.createElement('div');
    actions.className = 'monster-actions';

    const releaseButton = document.createElement('button');
    releaseButton.textContent = 'Release';
    releaseButton.onclick = async () => {
      if (isBusy) return;
      isBusy = true;
      const data = await apiRequest('/releaseMonster', {
        sessionCode,
        tokenId: parseInt(monster.tokenId),
      });
      if (data.type === 'releaseMonsterResult' && data.success) {
        await loadGame(); // Refresh monster list
      }
      isBusy = false;
    };

    const joinButton = document.createElement('button');
    joinButton.textContent = 'Join Fight';
    joinButton.onclick = () => {
      if (isBusy) return;
      const fightId = prompt('Enter fight ID to join:');
      if (fightId) {
        joinSelectedMonsterToFight(fightId, monster.tokenId);
      }
    };

    actions.appendChild(releaseButton);
    actions.appendChild(joinButton);
    info.appendChild(name);
    info.appendChild(actions);

    li.appendChild(img);
    li.appendChild(info);
    list.appendChild(li);
  });
}

const gridSize = 11;
let playerX = 5;
let playerY = 5;

const terrainTypes = ['tree', 'grass', 'dirt'];
let terrainMap = Array.from({ length: gridSize }, () =>
  Array.from({ length: gridSize }, () => terrainTypes[Math.floor(Math.random() * terrainTypes.length)])
);

function createGrid() {
  const grid = document.getElementById('grid');
  grid.innerHTML = '';

  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const cell = document.createElement('div');
      const terrain = terrainMap[y][x];

      cell.classList.add('cell', terrain);

      if (x === playerX && y === playerY) {
        cell.classList.add('player');
      }

      grid.appendChild(cell);
    }
  }
}

function handleArrowPress(event) {
  logBusy('Before handleArrowPress');
  if (isBusy) return;

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