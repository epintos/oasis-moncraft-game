const ws = new WebSocket('ws://localhost:8080');

ws.onopen = () => {
  document.getElementById('output').textContent = 'Connected to WebSocket server';
};

ws.onmessage = (event) => {
  try {
    const data = JSON.parse(event.data);
    document.getElementById('output').textContent = JSON.stringify(data, null, 2);
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