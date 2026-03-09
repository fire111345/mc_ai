document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("registerForm");
  const registerMessage = document.getElementById("registerMessage");

  function showMessage(text, isError = false) {
    if (!registerMessage) return;
    registerMessage.textContent = text;
    registerMessage.style.color = isError ? "#d93025" : "#2e7d32";
  }

  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const username = document.getElementById("username")?.value.trim() || "";
    const password = document.getElementById("password")?.value.trim() || "";
    const confirmPassword = document.getElementById("confirmPassword")?.value.trim() || "";

    if (!username || !password || !confirmPassword) {
      showMessage("请填写完整信息", true);
      return;
    }

    if (password !== confirmPassword) {
      showMessage("两次输入的密码不一致", true);
      return;
    }

    try {
      showMessage("注册中...");

      const res = await fetch("/api/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();

      if (data.success) {
        showMessage("注册成功，正在跳转...");
        setTimeout(() => {
          window.location.href = "/login";
        }, 500);
      } else {
        showMessage(data.message || "注册失败", true);
      }
    } catch (error) {
      console.error("注册失败：", error);
      showMessage("网络错误，请稍后重试", true);
    }
  });
});