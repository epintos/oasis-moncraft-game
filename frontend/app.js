const ws = new WebSocket('ws://localhost:8080');
let playerStep = 0; // Track player steps
let sessionCode = ''; // Store session code

ws.onopen = () => {
  document.getElementById('output').textContent = 'Connected to WebSocket server';
};

ws.onmessage = (event) => {
  try {
    const data = JSON.parse(event.data);
    document.getElementById('output').textContent = JSON.stringify(data, null, 2);
    if (data.type === 'startGameResult' && data.success) {
      sessionCode = data.sessionCode;
      document.getElementById('sessionCode').value = sessionCode;
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
    const request = {
      type: 'sendNativeToken',
      toAddress,
      amount,
    };
    ws.send(JSON.stringify(request));
  } else {
    document.getElementById('output').textContent = 'WebSocket is not connected';
  }
}

function startSession() {
  if (ws.readyState === WebSocket.OPEN) {
    const request = {
      type: 'startGame',
    };
    ws.send(JSON.stringify(request));
  } else {
    document.getElementById('output').textContent = 'WebSocket is not connected';
  }
}

function move() {
  if (!sessionCode) {
    document.getElementById('output').textContent = 'Please start a session first';
    return;
  }
  if (ws.readyState === WebSocket.OPEN) {
    playerStep += 1; // Increment step
    const request = {
      type: 'checkStep',
      sessionCode,
      playerStep,
    };
    ws.send(JSON.stringify(request));
  } else {
    document.getElementById('output').textContent = 'WebSocket is not connected';
  }
}