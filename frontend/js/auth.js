
document.addEventListener("DOMContentLoaded", () => {
  const registerForm = document.getElementById("register-form");
  const loginForm = document.getElementById("login-form");

  if (registerForm) {
    registerForm.addEventListener("submit", handleRegister);
  }

  if (loginForm) {
    loginForm.addEventListener("submit", handleLogin);
  }

  async function handleRegister(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const button = document.getElementById("register-button");
    const errorBox = document.getElementById("register-error");
    const successBox = document.getElementById("register-success");

    hideMessage(errorBox);
    hideMessage(successBox);

    const formData = new FormData(form);

    const name = String(formData.get("name") || "").trim();
    const username = String(formData.get("username") || "")
      .trim()
      .toLowerCase();
    const email = String(formData.get("email") || "")
      .trim()
      .toLowerCase();
    const password = String(formData.get("password") || "");

    if (name.length < 2 || name.length > 50) {
      showMessage(errorBox, "Your name must be between 2 and 50 characters.");
      return;
    }

    if (!/^[a-z0-9_]{3,24}$/.test(username)) {
      showMessage(
        errorBox,
        "Username must contain 3–24 lowercase letters, numbers, or underscores."
      );
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showMessage(errorBox, "Please enter a valid email address.");
      return;
    }

    if (password.length < 8 || password.length > 128) {
      showMessage(errorBox, "Your password must be between 8 and 128 characters.");
      return;
    }

    setLoading(button, true, "Creating account...");

    try {
      await API.register({
        name,
        username,
        email,
        password
      });

      showMessage(successBox, "Account created successfully! Redirecting to login...");

      form.reset();

      setTimeout(() => {
        window.location.href = "login.html";
      }, 1000);
    } catch (error) {
      showMessage(errorBox, error.message || "Registration failed. Please try again.");
    } finally {
      setLoading(button, false, "Create account →");
    }
  }

  async function handleLogin(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const button = document.getElementById("login-button");
    const errorBox = document.getElementById("login-error");
    const successBox = document.getElementById("login-success");

    hideMessage(errorBox);
    hideMessage(successBox);

    const formData = new FormData(form);

    const email = String(formData.get("email") || "")
      .trim()
      .toLowerCase();
    const password = String(formData.get("password") || "");

    if (!email || !password) {
      showMessage(errorBox, "Please enter your email and password.");
      return;
    }

    setLoading(button, true, "Logging in...");

    try {
      await API.login({ email, password });

      showMessage(successBox, "Login successful! Opening ThoughtSnap...");

      setTimeout(() => {
        window.location.href = "index.html";
      }, 600);
    } catch (error) {
      showMessage(errorBox, error.message || "Login failed. Check your details and try again.");
    } finally {
      setLoading(button, false, "Log in →");
    }
  }

  function showMessage(element, message) {
    if (!element) return;

    element.textContent = message;
    element.classList.add("show");
  }

  function hideMessage(element) {
    if (!element) return;

    element.textContent = "";
    element.classList.remove("show");
  }

  function setLoading(button, isLoading, text) {
    if (!button) return;

    if (!button.dataset.originalText) {
      button.dataset.originalText = button.textContent.trim();
    }

    button.disabled = isLoading;
    button.textContent = isLoading ? text : button.dataset.originalText;
  }
});
