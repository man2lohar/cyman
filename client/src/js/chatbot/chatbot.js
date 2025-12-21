async function sendMessage() {
    const input = document.getElementById('userInput');
    const chatbox = document.getElementById('chatbox');
    const userMessage = input.value;
  
    if (!userMessage.trim()) return;
  
    chatbox.innerHTML += `<div class="msg user"><strong>You:</strong> ${userMessage}</div>`;
    input.value = '';
  
    const res = await fetch("http://localhost:3000/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input: userMessage })
    });
  
    const data = await res.json();
    chatbox.innerHTML += `<div class="msg bot"><strong>AI:</strong> ${data.response}</div>`;
  }
  