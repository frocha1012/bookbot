const API_KEY = "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";
let ttsEnabled = true;
let conversations = JSON.parse(localStorage.getItem('bookbot_conversations') || '{}');
let currentId = null;

const form = document.getElementById('chat-form');
const input = document.getElementById('user-input');
const chatBox = document.getElementById('chat-box');
const chatList = document.getElementById('chat-list');
const chatTitle = document.getElementById('chat-title');
const newChatBtn = document.getElementById('new-chat');
const editBtn = document.getElementById('edit-title');
const deleteBtn = document.getElementById('delete-chat');
const newTitleInput = document.getElementById('new-title');
const saveBtn = document.getElementById('save-title');
const editModal = new bootstrap.Modal(document.getElementById('editModal'));

const ttsBtn = document.getElementById('toggle-tts');
const ttsIcon = document.getElementById('tts-icon');

ttsBtn.addEventListener('click', () => {
  ttsEnabled = !ttsEnabled;
  ttsIcon.className = ttsEnabled ? 'bi bi-volume-up' : 'bi bi-volume-mute';
});

const typingIndicator = document.getElementById('typing-indicator');
const dots = document.getElementById('dots');
let dotInterval = null;

function speak(text) {
  if (!ttsEnabled) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  speechSynthesis.speak(utterance);
}

function saveConversations() {
  localStorage.setItem('bookbot_conversations', JSON.stringify(conversations));
}

function loadConversation(id) {
  currentId = id;
  const conv = conversations[id];
  chatTitle.textContent = conv.title;
  chatBox.innerHTML = '';
  conv.messages.forEach(msg => {
    const role = msg.role === "assistant" ? "bot" : msg.role;
    appendMessage(role, msg.content);
  });
}

function appendMessage(sender, text) {
  const messageElem = document.createElement('div');
  messageElem.className = `message ${sender}`;

  if (sender === 'bot') {
    messageElem.style.alignSelf = 'flex-start';
    const label = document.createElement('strong');
    label.textContent = "BookBot: ";
    label.style.marginRight = '4px';

    const content = document.createElement('span');
    content.innerHTML = text.replace(/\n/g, "<br>");
    messageElem.appendChild(label);
    messageElem.appendChild(content);
  } else {
    messageElem.style.alignSelf = 'flex-end';
    messageElem.textContent = text;
  }

  chatBox.appendChild(messageElem);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function updateSidebar() {
  chatList.innerHTML = '';
  for (const id in conversations) {
    const item = document.createElement('li');
    item.className = 'list-group-item bg-transparent';
    item.textContent = conversations[id].title;
    item.onclick = () => loadConversation(id);
    chatList.appendChild(item);
  }
}

newChatBtn.onclick = () => {
  const id = Date.now().toString();
  conversations[id] = { title: "New Chat", messages: [] };
  saveConversations();
  updateSidebar();
  loadConversation(id);
};

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const userMessage = input.value.trim();
  if (!userMessage || !currentId) return;

  appendMessage('user', userMessage);
  conversations[currentId].messages.push({ role: "user", content: userMessage });
  input.value = '';
  saveConversations();

  typingIndicator.style.display = "block";
  dots.textContent = ".";
  dotInterval = setInterval(() => {
    dots.textContent = dots.textContent.length >= 3 ? "." : dots.textContent + ".";
  }, 500);

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: "mistralai/mixtral-8x7b-instruct",
        messages: [
          { role: "system", content: "You are BookBot, a literary expert. Only respond to messages related to books, literature, authors, genres, or reading. If a question is unrelated to literature, politely respond that you only answer book-related queries." },
          ...conversations[currentId].messages,
        ],
      }),
    });

    const data = await response.json();
    const botMessage = data.choices?.[0]?.message?.content || "Sorry, something went wrong.";

    clearInterval(dotInterval);
    typingIndicator.style.display = "none";

    appendMessage('bot', botMessage);
    speak(botMessage);
    conversations[currentId].messages.push({ role: "assistant", content: botMessage });

    if (conversations[currentId].title === "New Chat" && userMessage.length > 10) {
      conversations[currentId].title = userMessage.slice(0, 30) + "...";
      updateSidebar();
    }

    saveConversations();
  } catch (error) {
    clearInterval(dotInterval);
    typingIndicator.style.display = "none";
    appendMessage('bot', "Error contacting the API.");
    console.error(error);
  }
});

editBtn.addEventListener('click', () => {
  if (!currentId) return;
  newTitleInput.value = conversations[currentId].title;
  editModal.show();
});

saveBtn.addEventListener('click', () => {
  const newTitle = newTitleInput.value.trim();
  if (newTitle && currentId) {
    conversations[currentId].title = newTitle;
    chatTitle.textContent = newTitle;
    updateSidebar();
    saveConversations();
    editModal.hide();
  }
});

deleteBtn.addEventListener("click", () => {
  if (!currentId) return;
  const confirmDelete = confirm("Are you sure you want to delete this conversation?");
  if (!confirmDelete) return;

  delete conversations[currentId];
  saveConversations();

  updateSidebar();

  const first = Object.keys(conversations)[0];
  if (first) loadConversation(first);
  else {
    chatTitle.textContent = "New Chat";
    chatBox.innerHTML = '';
    currentId = null;
  }
});

window.onload = () => {
  updateSidebar();
  const first = Object.keys(conversations)[0];
  if (first) loadConversation(first);
  else newChatBtn.click();
};
