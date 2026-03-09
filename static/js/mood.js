document.addEventListener("DOMContentLoaded", () => {
  const authArea = document.getElementById("authArea");
  const moodOptions = document.querySelectorAll(".mood-option");
  const moodNote = document.getElementById("moodNote");
  const saveMoodBtn = document.getElementById("saveMoodBtn");
  const moodMessage = document.getElementById("moodMessage");
  const moodHistory = document.getElementById("moodHistory");
  const clearAllBtn = document.getElementById("clearAllBtn");

  let selectedMood = "";

  async function logout() {
    try {
      const res = await fetch("/api/logout", {
        method: "POST"
      });

      const data = await res.json();

      if (data.success) {
        window.location.href = "/login";
      } else {
        alert(data.message || "退出失败");
      }
    } catch (error) {
      console.error("退出登录失败：", error);
      alert("网络错误，请稍后重试");
    }
  }

  async function loadAuthState() {
    try {
      const res = await fetch("/api/me");
      const data = await res.json();

      if (data.success && data.data?.username) {
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
        window.location.href = "/login";
      }
    } catch (error) {
      console.error("获取登录状态失败：", error);
      window.location.href = "/login";
    }
  }

  async function loadMoodHistory() {
    try {
      const res = await fetch("/api/moods");
      const data = await res.json();

      if (!data.success) {
        if (res.status === 401) {
          window.location.href = "/login";
        }
        moodHistory.innerHTML = `<p class="empty-tip">加载失败，请稍后重试。</p>`;
        return;
      }

      renderMoodHistory(data.data || []);
    } catch (error) {
      console.error("加载心情记录失败：", error);
      moodHistory.innerHTML = `<p class="empty-tip">网络异常，请稍后重试。</p>`;
    }
  }

  function renderMoodHistory(records) {
    if (!moodHistory) return;

    if (!Array.isArray(records) || records.length === 0) {
      moodHistory.innerHTML = `<p class="empty-tip">还没有记录，先写下今天的心情吧。</p>`;
      return;
    }

    moodHistory.innerHTML = "";

    records.forEach((record) => {
      const item = document.createElement("div");
      item.className = "history-item";

      item.innerHTML = `
        <div class="history-item-top">
          <div>
            <span class="history-mood">${record.mood}</span>
            <span class="history-time">${record.created_at}</span>
          </div>
        </div>
        <p class="history-content">${record.content ? record.content : "今天没有填写文字记录。"}</p>
      `;

      moodHistory.appendChild(item);
    });
  }

  moodOptions.forEach((button) => {
    button.addEventListener("click", () => {
      moodOptions.forEach((btn) => btn.classList.remove("selected"));
      button.classList.add("selected");
      selectedMood = button.dataset.mood;
    });
  });

  if (saveMoodBtn) {
    saveMoodBtn.addEventListener("click", async () => {
      const content = moodNote.value.trim();

      if (!selectedMood) {
        moodMessage.style.color = "#ef4444";
        moodMessage.textContent = "请先选择今天的心情。";
        return;
      }

      try {
        saveMoodBtn.disabled = true;
        saveMoodBtn.textContent = "保存中...";

        const res = await fetch("/api/mood", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            mood: selectedMood,
            content: content
          })
        });

        const data = await res.json();

        if (data.success) {
          moodMessage.style.color = "#16a34a";
          moodMessage.textContent = data.message || "心情记录保存成功";

          moodOptions.forEach((btn) => btn.classList.remove("selected"));
          selectedMood = "";
          moodNote.value = "";

          await loadMoodHistory();
        } else {
          moodMessage.style.color = "#ef4444";
          moodMessage.textContent = data.message || "保存失败";

          if (res.status === 401) {
            setTimeout(() => {
              window.location.href = "/login";
            }, 800);
          }
        }
      } catch (error) {
        console.error("保存心情失败：", error);
        moodMessage.style.color = "#ef4444";
        moodMessage.textContent = "网络异常，请稍后重试";
      } finally {
        saveMoodBtn.disabled = false;
        saveMoodBtn.textContent = "保存记录";
      }
    });
  }

  if (clearAllBtn) {
    clearAllBtn.addEventListener("click", async () => {
      const confirmed = confirm("确定要清空全部心情记录吗？");
      if (!confirmed) return;

      try {
        const res = await fetch("/api/moods/clear", {
          method: "POST"
        });

        const data = await res.json();

        if (data.success) {
          moodMessage.style.color = "#16a34a";
          moodMessage.textContent = data.message || "已清空全部心情记录";
          renderMoodHistory([]);
        } else {
          moodMessage.style.color = "#ef4444";
          moodMessage.textContent = data.message || "清空失败";

          if (res.status === 401) {
            setTimeout(() => {
              window.location.href = "/login";
            }, 800);
          }
        }
      } catch (error) {
        console.error("清空心情记录失败：", error);
        moodMessage.style.color = "#ef4444";
        moodMessage.textContent = "网络异常，请稍后重试";
      }
    });
  }

  loadAuthState();
  loadMoodHistory();
});