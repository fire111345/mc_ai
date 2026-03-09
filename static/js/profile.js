document.addEventListener("DOMContentLoaded", () => {
  const profileAvatar = document.getElementById("profileAvatar");
  const profileUsername = document.getElementById("profileUsername");
  const profileWelcome = document.getElementById("profileWelcome");
  const totalMoodCount = document.getElementById("totalMoodCount");
  const latestMood = document.getElementById("latestMood");
  const latestMoodTime = document.getElementById("latestMoodTime");
  const logoutBtn = document.getElementById("logoutBtn");
  const profileMessage = document.getElementById("profileMessage");

  function showMessage(text, isError = false) {
    if (!profileMessage) return;
    profileMessage.textContent = text;
    profileMessage.style.color = isError ? "#d93025" : "#2e7d32";
  }

  async function loadProfile() {
    try {
      const res = await fetch("/api/profile");
      const data = await res.json();

      if (!data.success) {
        window.location.href = "/login";
        return;
      }

      const user = data.data || {};
      const username = user.username || "未登录用户";

      if (profileUsername) profileUsername.textContent = username;
      if (profileWelcome) profileWelcome.textContent = `你好，${username}，欢迎来到你的个人中心。`;
      if (profileAvatar) profileAvatar.textContent = username.charAt(0).toUpperCase();
      if (totalMoodCount) totalMoodCount.textContent = user.total_mood_count ?? 0;
      if (latestMood) latestMood.textContent = user.latest_mood || "暂无记录";
      if (latestMoodTime) latestMoodTime.textContent = user.latest_mood_time || "暂无记录";
    } catch (error) {
      console.error("获取个人信息失败：", error);
      window.location.href = "/login";
    }
  }

  async function logout() {
    try {
      const res = await fetch("/api/logout", {
        method: "POST"
      });

      const data = await res.json();

      if (data.success) {
        showMessage("已退出登录");
        setTimeout(() => {
          window.location.href = "/login";
        }, 500);
      } else {
        showMessage(data.message || "退出失败", true);
      }
    } catch (error) {
      console.error("退出登录失败：", error);
      showMessage("网络错误，请稍后再试", true);
    }
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", logout);
  }

  loadProfile();
});