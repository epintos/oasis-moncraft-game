const ws = new WebSocket("ws://localhost:8080/");
// const ws = new WebSocket("wss://84.255.245.194:5100");

let playerStep = 0;
let sessionCode = "";
let isBusy = true;

function logBusy(context) {
  console.log(`[isBusy] ${context}:`, isBusy);
}

ws.onopen = () => {
  document.getElementById("output").textContent =
    "Connected to WebSocket server";
};

ws.onmessage = (event) => {
  try {
    const data = JSON.parse(event.data);
    document.getElementById("output").textContent = JSON.stringify(
      data,
      null,
      2
    );

    if (data.type === "startGameResult" && data.success) {
      sessionCode = data.sessionCode;
      playerStep = 0;
      document.getElementById("sessionCode").value = sessionCode;
      isBusy = false;
    }

    if (data.type === "loadGameResult" && data.success) {
      sessionCode = data.sessionCode;
      playerStep = data.currentStep || 0;
      document.getElementById("sessionCode").value = sessionCode;
      renderMonsterList(data.monsters || []);

      isBusy = false;
    }

    if (data.type === "saveGameResult" && data.success) {
      console.log(`Game saved at step ${playerStep}`);
      isBusy = false;
    }

    if (data.type === "checkStepResult") {
      if (data.hasAppeared) {
        isBusy = true;
        const confirmed = confirm(
          `A wild monster appeared (index ${data.monsterIndex})! Try to capture it?`
        );
        if (confirmed) {
          const request = {
            type: "captureMonster",
            sessionCode,
            monsterIndex: parseInt(data.monsterIndex),
            currentStep: playerStep,
          };
          ws.send(JSON.stringify(request));
        } else {
          isBusy = false;
        }
      } else {
        isBusy = false;
      }
    }

    if (data.type === "captureMonsterResult" && data.success) {
      isBusy = true;
      alert(data.message);

      if (ws.readyState === WebSocket.OPEN) {
        isBusy = true;
        logBusy("Locking before sending loadGame after capture");
        ws.send(
          JSON.stringify({
            type: "loadGame",
            sessionCode,
          })
        );
      } else {
        isBusy = false;
      }
    }

    if (data.type === "releaseMonsterResult" && data.success) {
      isBusy = true;
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: "loadGame",
            sessionCode,
          })
        );
      } else {
        isBusy = false;
      }
    }

    if (data.type === 'joinFightResult') {
      if (data.success) {
        isBusy = true;
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'loadGame',
            sessionCode
          }));
        }
      } else {
        isBusy = false;
        alert("Failed to join fight: " + data.message);
      }
    }    
      
  } catch (error) {
    document.getElementById("output").textContent = "Error parsing response";
  }
};

ws.onclose = () => {
  document.getElementById("output").textContent =
    "Disconnected from WebSocket server";
};

ws.onerror = (error) => {
  document.getElementById("output").textContent = `WebSocket error: ${
    error.message || "Unknown error"
  }`;
};

function startSession() {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "startGame" }));
  } else {
    document.getElementById("output").textContent =
      "WebSocket is not connected";
  }
}

function loadGame() {
  const inputCode = document.getElementById("sessionCode").value.trim();
  if (!inputCode) {
    document.getElementById("output").textContent =
      "Please enter a session code to load";
    return;
  }

  if (ws.readyState === WebSocket.OPEN) {
    ws.send(
      JSON.stringify({
        type: "loadGame",
        sessionCode: inputCode,
      })
    );
  } else {
    document.getElementById("output").textContent =
      "WebSocket is not connected";
  }
}

function move() {
  if (!sessionCode) {
    document.getElementById("output").textContent =
      "Please start or load a session first";
    return;
  }

  if (ws.readyState === WebSocket.OPEN) {
    const request = {
      type: "checkStep",
      sessionCode,
      playerStep: playerStep++,
    };
    ws.send(JSON.stringify(request));
  } else {
    document.getElementById("output").textContent =
      "WebSocket is not connected";
  }
}

function saveGame() {
  if (!sessionCode) {
    document.getElementById("output").textContent = "No session to save";
    return;
  }

  if (ws.readyState === WebSocket.OPEN) {
    const request = {
      type: "saveGame",
      sessionCode,
      currentStep: playerStep,
    };
    ws.send(JSON.stringify(request));
  } else {
    document.getElementById("output").textContent =
      "WebSocket is not connected";
  }
}

function joinSelectedMonsterToFight(fightId, tokenId) {
  if (!sessionCode) {
    document.getElementById('output').textContent = 'No session active';
    return;
  }

  isBusy = true;
  logBusy("Sending joinFight request");

  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'joinFight',
      fightId: parseInt(fightId),
      sessionCode,
      tokenId: parseInt(tokenId),
    }));
  } else {
    document.getElementById('output').textContent = 'WebSocket is not connected';
  }
}

function renderMonsterList(monsters) {
  const list = document.getElementById("monsterList");
  list.innerHTML = "";

  if (!monsters || monsters.length === 0) {
    list.innerHTML = "<li>None</li>";
    return;
  }

  monsters.forEach((id) => {
    const li = document.createElement("li");
    li.textContent = `Monster #${id} `;

    const releaseButton = document.createElement("button");
    releaseButton.textContent = "Release";
    releaseButton.onclick = () => {
      isBusy = true;
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: "releaseMonster",
            sessionCode,
            tokenId: parseInt(id),
          })
        );
      }
    };

    const joinButton = document.createElement('button');
    joinButton.textContent = 'Join Fight';
    joinButton.onclick = () => {
      const fightId = prompt('Enter fight ID to join:');
      if (fightId) {
        joinSelectedMonsterToFight(fightId, id);
      }
    };
        
    li.appendChild(releaseButton);
    li.appendChild(joinButton);
    list.appendChild(li);
  });
}

const gridSize = 11;
let playerX = 5;
let playerY = 5;

function createGrid() {
  const grid = document.getElementById("grid");
  grid.innerHTML = "";
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const cell = document.createElement("div");
      cell.classList.add("cell");
      if (x === playerX && y === playerY) {
        cell.classList.add("player");
      }
      grid.appendChild(cell);
    }
  }
}

function handleArrowPress(event) {
  logBusy("Before handleArrowPress");
  if (isBusy) return;

  let moved = false;
  if (event.key === "ArrowUp" && playerY > 0) {
    playerY--;
    moved = true;
  } else if (event.key === "ArrowDown" && playerY < gridSize - 1) {
    playerY++;
    moved = true;
  } else if (event.key === "ArrowLeft" && playerX > 0) {
    playerX--;
    moved = true;
  } else if (event.key === "ArrowRight" && playerX < gridSize - 1) {
    playerX++;
    moved = true;
  }

  if (moved) {
    createGrid();
    isBusy = true;
    logBusy("After setting isBusy true in handleArrowPress");
    move();
  }
}

document.addEventListener("keydown", handleArrowPress);
createGrid();
