
const isLocal =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1";

const API_BASE_URL = (
  window.THOUGHTSNAP_API_URL ||
  (isLocal
    ? "http://localhost:5000/api"
    : "https://YOUR-RENDER-BACKEND.onrender.com/api")
).replace(/\/+$/, "");

const API = {
  async request(endpoint, options = {}) {
    const config = {
      method: options.method || "GET",
      credentials: "include",
      headers: {
        ...(options.body instanceof FormData
          ? {}
          : options.body
            ? { "Content-Type": "application/json" }
            : {}),
        ...(options.headers || {})
      }
    };

    if (options.body !== undefined) {
      config.body =
        options.body instanceof FormData
          ? options.body
          : typeof options.body === "string"
            ? options.body
            : JSON.stringify(options.body);
    }

    let response;

    try {
      response = await fetch(`${API_BASE_URL}${endpoint}`, config);
    } catch {
      throw new Error(
        "Cannot connect to ThoughtSnap. Check the backend URL and server status."
      );
    }

    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json")
      ? await response.json()
      : {};

    if (!response.ok) {
      throw new Error(
        data.message || `Request failed with status ${response.status}`
      );
    }

    return data;
  },

  register(userData) {
    return this.request("/auth/register", {
      method: "POST",
      body: userData
    });
  },

  login(credentials) {
    return this.request("/auth/login", {
      method: "POST",
      body: credentials
    });
  },

  logout() {
    return this.request("/auth/logout", { method: "POST" });
  },

  getMe() {
    return this.request("/auth/me");
  },

  getPosts() {
    return this.request("/posts");
  },

  createPost(formData) {
    return this.request("/posts", {
      method: "POST",
      body: formData
    });
  },

  toggleLike(postId) {
    return this.request(
      `/posts/${encodeURIComponent(postId)}/like`,
      { method: "POST" }
    );
  },

  addComment(postId, text) {
    return this.request(
      `/posts/${encodeURIComponent(postId)}/comments`,
      { method: "POST", body: { text } }
    );
  },

  searchUsers(query) {
    return this.request(
      `/users/search?q=${encodeURIComponent(query)}`
    );
  },

  getProfile(username) {
    return this.request(
      `/users/${encodeURIComponent(username)}`
    );
  },

  updateProfile(profileData) {
    return this.request("/users/me", {
      method: "PUT",
      body: profileData
    });
  },

  toggleFollow(userId) {
    return this.request(
      `/users/${encodeURIComponent(userId)}/follow`,
      { method: "POST" }
    );
  }
};

window.API = API;
