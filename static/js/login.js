document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("loginForm");
  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");
  const loginMessage = document.getElementById("loginMessage");

  function showMessage(text, isError = false) {
    if (!loginMessage) return;
    loginMessage.textContent = text;
    loginMessage.style.color = isError ? "#d9534f" : "#2e7d32";
  }

  if (!loginForm) return;

  loginForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    if (!username || !password) {
      showMessage("请输入用户名和密码", true);
      return;
    }

    showMessage("正在登录...", false);

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          username: username,
          password: password
        })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        showMessage(result.message || "登录失败，请稍后再试", true);
        return;
      }

      showMessage(result.message || "登录成功，正在跳转...");

      if (result.data && result.data.username) {
        localStorage.setItem("mindcare_username", result.data.username);
      }

      setTimeout(() => {
        window.location.href = "/chat_page";
      }, 800);
    } catch (error) {
      console.error("登录请求失败：", error);
      showMessage("无法连接后端，请确认 Flask 服务已启动", true);
    }
  });
});