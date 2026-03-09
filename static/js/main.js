document.addEventListener("DOMContentLoaded", () => {
  const authArea = document.getElementById("authArea");
  const startBtn = document.getElementById("startBtn");
  const chatBtn = document.getElementById("chatBtn");

  function bindHeroButtons(isLoggedIn) {
    if (startBtn) {
      startBtn.addEventListener("click", () => {
        window.location.href = isLoggedIn ? "/chat_page" : "/login";
      });
    }

    if (chatBtn) {
      chatBtn.addEventListener("click", () => {
        window.location.href = isLoggedIn ? "/chat_page" : "/login";
      });
    }
  }

  async function logout() {
    try {
      const res = await fetch("/api/logout", {
        method: "POST"
      });
      const data = await res.json();

      if (data.success) {
        window.location.href = "/";
      } else {
        alert(data.message || "退出失败");
      }
    } catch (error) {
      console.error("退出登录失败：", error);
      alert("网络错误，请稍后重试");
    }
  }

  async function loadAuthState() {
    let isLoggedIn = false;

    try {
      const res = await fetch("/api/me");
      const data = await res.json();

      if (data.success && data.data?.username) {
        isLoggedIn = true;
        const username = data.data.username;

        if (authArea) {
          authArea.innerHTML = `
            <div class="user-box">
              <a href="/profile_page" class="user-name">${username}</a>
              <button id="logoutBtnTop" class="logout-btn" type="button">退出</button>
            </div>
          `;

          const logoutBtnTop = document.getElementById("logoutBtnTop");
          if (logoutBtnTop) {
            logoutBtnTop.addEventListener("click", logout);
          }
        }
      } else {
        if (authArea) {
          authArea.innerHTML = `<a href="/login" class="login-btn">登录</a>`;
        }
      }
    } catch (error) {
      console.error("获取登录状态失败：", error);
      if (authArea) {
        authArea.innerHTML = `<a href="/login" class="login-btn">登录</a>`;
      }
    }

    bindHeroButtons(isLoggedIn);
  }

  loadAuthState();
});