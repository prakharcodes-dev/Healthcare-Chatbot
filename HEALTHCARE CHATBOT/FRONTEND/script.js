async function sendMessage() {

    let input = document.getElementById("userInput");
    let chatBox = document.getElementById("chatBox");

    let userText = input.value.trim();
    if(userText === "") return;

    // User message
    let userMsg = document.createElement("div");
    userMsg.className = "user-msg";
    userMsg.innerText = userText;
    chatBox.appendChild(userMsg);

    input.value = "";

    // Send to backend
    let response = await fetch("http://127.0.0.1:8000/chat", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            message: userText
        })
    });

    let data = await response.json();

    // Bot reply
    let botMsg = document.createElement("div");
    botMsg.className = "bot-msg";
    botMsg.innerText = data.reply;
    chatBox.appendChild(botMsg);

    chatBox.scrollTop = chatBox.scrollHeight;
}
