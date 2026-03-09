document.addEventListener("DOMContentLoaded", () => {
  const chatMessages = document.getElementById("chatMessages");
  const messageInput = document.getElementById("messageInput");
  const sendBtn = document.getElementById("sendBtn");
  const welcomeText = document.getElementById("welcomeText");
  const sessionList = document.getElementById("sessionList");
  const newChatBtn = document.getElementById("newChatBtn");
  const chatTitle = document.getElementById("chatTitle");

  const contextMenu = document.getElementById("contextMenu");
  const renameSessionBtn = document.getElementById("renameSessionBtn");
  const deleteSessionBtn = document.getElementById("deleteSessionBtn");

  let currentSessionId = null;
  let currentSessionTitle = "AI 心理陪伴对话";
  let contextSessionId = null;

  function appendMessage(role, text) {
    if (!chatMessages) return;

    const msg = document.createElement("div");
    msg.className = role === "user" ? "message user-message" : "message ai-message";
    msg.textContent = text;
    chatMessages.appendChild(msg);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function setInputDisabled(disabled) {
    if (messageInput) messageInput.disabled = disabled;
    if (sendBtn) sendBtn.disabled = disabled;
  }

  function showDefaultWelcome() {
    chatMessages.innerHTML = "";
    appendMessage("ai", "你好，我是你的心理陪伴助手。今天过得怎么样？");
  }

  function closeContextMenu() {
    if (contextMenu) {
      contextMenu.style.display = "none";
    }
    contextSessionId = null;
  }

  function updateChatTitle(title) {
    currentSessionTitle = title || "AI 心理陪伴对话";
    if (chatTitle) {
      chatTitle.textContent = currentSessionTitle;
    }
  }

  async function loadCurrentUser() {
    try {
      const res = await fetch("/api/me");
      const data = await res.json();

      if (data.success && data.data?.username) {
        if (welcomeText) {
          welcomeText.textContent = `你好，${data.data.username}`;
        }
      } else {
        window.location.href = "/login";
      }
    } catch (error) {
      console.error("获取用户信息失败：", error);
      window.location.href = "/login";
    }
  }

  function renderSessionList(sessions) {
    if (!sessionList) return;

    sessionList.innerHTML = "";

    sessions.forEach((session) => {
      const item = document.createElement("div");
      item.className = "session-item";
      if (session.id === currentSessionId) {
        item.classList.add("active");
      }

      item.textContent = session.title || "新对话";
      item.dataset.id = session.id;
      item.dataset.title = session.title || "新对话";

      item.addEventListener("click", async () => {
        currentSessionId = session.id;
        updateChatTitle(session.title || "AI 心理陪伴对话");
        await loadChatHistory(session.id);
        await loadChatSessions();
      });

      item.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        contextSessionId = session.id;

        if (contextMenu) {
          contextMenu.style.display = "block";
          contextMenu.style.left = `${e.pageX}px`;
          contextMenu.style.top = `${e.pageY}px`;
        }
      });

      sessionList.appendChild(item);
    });
  }

  async function loadChatSessions() {
    try {
      const res = await fetch("/api/chat_sessions");
      const data = await res.json();

      if (!data.success) {
        if (res.status === 401) {
          window.location.href = "/login";
        }
        return;
      }

      const sessions = Array.isArray(data.data) ? data.data : [];

      if (sessions.length === 0) {
        currentSessionId = null;
        renderSessionList([]);
        showDefaultWelcome();
        updateChatTitle("AI 心理陪伴对话");
        return;
      }

      if (!currentSessionId) {
        currentSessionId = sessions[0].id;
      }

      const activeSession =
        sessions.find((item) => item.id === currentSessionId) || sessions[0];

      currentSessionId = activeSession.id;
      updateChatTitle(activeSession.title || "AI 心理陪伴对话");
      renderSessionList(sessions);
    } catch (error) {
      console.error("加载会话列表失败：", error);
    }
  }

  async function loadChatHistory(sessionId) {
    try {
      const res = await fetch(`/api/chat_history?session_id=${sessionId}`);
      const data = await res.json();

      if (!data.success) {
        if (res.status === 401) {
          window.location.href = "/login";
        }
        return;
      }

      chatMessages.innerHTML = "";

      if (!Array.isArray(data.data) || data.data.length === 0) {
        appendMessage("ai", "你好，我是你的心理陪伴助手。今天过得怎么样？");
        return;
      }

      data.data.forEach((item) => {
        appendMessage("user", item.user_message);
        appendMessage("ai", item.ai_reply);
      });
    } catch (error) {
      console.error("加载聊天记录失败：", error);
    }
  }

  async function createNewSession() {
    try {
      const res = await fetch("/api/chat_sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ title: "新对话" })
      });

      const data = await res.json();

      if (!data.success) {
        alert(data.message || "新建对话失败");
        return;
      }

      currentSessionId = data.data.id;
      updateChatTitle(data.data.title || "AI 心理陪伴对话");
      showDefaultWelcome();
      await loadChatSessions();
    } catch (error) {
      console.error("新建会话失败：", error);
      alert("网络异常，请稍后再试");
    }
  }

  async function renameSession(sessionId) {
    const newTitle = prompt("请输入新的对话名称");
    if (!newTitle || !newTitle.trim()) return;

    try {
      const res = await fetch(`/api/chat_sessions/${sessionId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ title: newTitle.trim() })
      });

      const data = await res.json();

      if (!data.success) {
        alert(data.message || "重命名失败");
        return;
      }

      if (sessionId === currentSessionId) {
        updateChatTitle(newTitle.trim());
      }

      await loadChatSessions();
    } catch (error) {
      console.error("重命名会话失败：", error);
      alert("网络异常，请稍后再试");
    }
  }

  async function deleteSession(sessionId) {
    const ok = confirm("确定删除这段对话吗？删除后不可恢复。");
    if (!ok) return;

    try {
      const res = await fetch(`/api/chat_sessions/${sessionId}`, {
        method: "DELETE"
      });

      const data = await res.json();

      if (!data.success) {
        alert(data.message || "删除失败");
        return;
      }

      currentSessionId = null;
      await loadChatSessions();

      if (currentSessionId) {
        await loadChatHistory(currentSessionId);
      } else {
        showDefaultWelcome();
      }
    } catch (error) {
      console.error("删除会话失败：", error);
      alert("网络异常，请稍后再试");
    }
  }

  async function sendMessage() {
    const message = messageInput?.value.trim() || "";
    if (!message) return;

    if (!currentSessionId) {
      await createNewSession();
    }

    appendMessage("user", message);
    messageInput.value = "";
    setInputDisabled(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message,
          session_id: currentSessionId
        })
      });

      const data = await res.json();

      if (data.success) {
        const reply = data.data?.reply || "我收到了你的消息。";
        appendMessage("ai", reply);

        if (data.data?.session_id) {
          currentSessionId = data.data.session_id;
        }

        if (data.data?.session_title) {
          updateChatTitle(data.data.session_title);
        }

        await loadChatSessions();
      } else {
        appendMessage("ai", data.message || "发送失败，请稍后再试。");
        if (res.status === 401) {
          setTimeout(() => {
            window.location.href = "/login";
          }, 800);
        }
      }
    } catch (error) {
      console.error("发送消息失败：", error);
      appendMessage("ai", "网络异常，请稍后再试。");
    } finally {
      setInputDisabled(false);
      messageInput?.focus();
    }
  }

  if (sendBtn) {
    sendBtn.addEventListener("click", sendMessage);
  }

  if (messageInput) {
    messageInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        sendMessage();
      }
    });
  }

  if (newChatBtn) {
    newChatBtn.addEventListener("click", createNewSession);
  }

  if (renameSessionBtn) {
    renameSessionBtn.addEventListener("click", async () => {
      if (contextSessionId) {
        await renameSession(contextSessionId);
      }
      closeContextMenu();
    });
  }

  if (deleteSessionBtn) {
    deleteSessionBtn.addEventListener("click", async () => {
      if (contextSessionId) {
        await deleteSession(contextSessionId);
      }
      closeContextMenu();
    });
  }

  document.addEventListener("click", () => {
    closeContextMenu();
  });

  window.addEventListener("scroll", closeContextMenu);
  window.addEventListener("resize", closeContextMenu);

  async function init() {
    await loadCurrentUser();
    await loadChatSessions();
    if (currentSessionId) {
      await loadChatHistory(currentSessionId);
    } else {
      showDefaultWelcome();
    }
  }

  init();
});