
document.addEventListener("DOMContentLoaded", () => {
  const feedContainer = document.getElementById("feed-container");
  const createPostForm = document.getElementById("create-post-form");
  const loginPrompt = document.getElementById("composer-login-prompt");
  const postImage = document.getElementById("post-image");
  const postCaption = document.getElementById("post-caption");
  const postError = document.getElementById("post-form-error");
  const postSuccess = document.getElementById("post-form-success");
  const publishButton = document.getElementById("publish-post-button");
  const year = document.getElementById("current-year");

  if (year) {
    year.textContent = new Date().getFullYear();
  }

  let currentUser = null;

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[character]);
  }

  function showFormMessage(element, message) {
    if (!element) return;
    element.textContent = message;
    element.hidden = false;
  }

  function clearFormMessages() {
    if (postError) {
      postError.textContent = "";
      postError.hidden = true;
    }

    if (postSuccess) {
      postSuccess.textContent = "";
      postSuccess.hidden = true;
    }
  }

  function getUserId(user) {
    return String(user?._id || user?.id || user?.userId || "");
  }

  function isOwnPost(post) {
    const loggedInUserId = getUserId(currentUser);
    const authorId = getUserId(post.author);

    return Boolean(
      loggedInUserId &&
      authorId &&
      loggedInUserId === authorId
    );
  }

  async function checkLogin() {
    try {
      const result = await API.getMe();

      currentUser =
        result?.user ||
        result?.data?.user ||
        result?.data ||
        null;
    } catch (error) {
      currentUser = null;
    }

    if (createPostForm) {
      createPostForm.hidden = !currentUser;
    }

    if (loginPrompt) {
      loginPrompt.hidden = Boolean(currentUser);
    }

    // Important:
    // Do not replace navActions.innerHTML here.
    // index.html handles Profile, Logout and the notification bell.
    // Replacing the navigation was hiding the notification bell.
  }

  function createPostCard(post) {
    const author = post.author || {};
    const authorName = escapeHTML(author.name || "ThoughtSnap user");
    const username = escapeHTML(author.username || "user");
    const caption = escapeHTML(post.caption || "");
    const imageUrl = escapeHTML(post.imageUrl || "");
    const rawPostId = String(post.id || post._id || "");
    const postId = escapeHTML(rawPostId);

    const likes = Array.isArray(post.likes)
      ? post.likes.length
      : Number(post.likesCount || 0);

    const comments = Array.isArray(post.comments)
      ? post.comments
      : [];

    const ownPost = isOwnPost(post);

    const card = document.createElement("article");
    card.className = "feed-card";

    card.innerHTML = `
      <div class="feed-card-header">
        <div class="user-avatar">
          ${escapeHTML((author.name || "U").charAt(0).toUpperCase())}
        </div>

        <div>
          <strong>${authorName}</strong>
          <p>@${username}</p>
        </div>

        ${
          ownPost
            ? `
              <button
                class="delete-post-button"
                type="button"
                data-post-id="${postId}"
                style="
                  margin-left:auto;
                  border:1px solid #dc2626;
                  color:#dc2626;
                  background:transparent;
                  padding:8px 12px;
                  border-radius:8px;
                  cursor:pointer;
                "
              >
                Delete
              </button>
            `
            : ""
        }
      </div>

      ${
        imageUrl
          ? `
            <img
              class="feed-card-image"
              src="${imageUrl}"
              alt="Photo shared by ${authorName}"
              loading="lazy"
              referrerpolicy="no-referrer"
            >
          `
          : ""
      }

      <div class="feed-card-content">
        ${
          caption
            ? `<p class="feed-caption">${caption}</p>`
            : ""
        }

        <div class="feed-card-actions">
          <button
            class="post-like-button"
            type="button"
            data-post-id="${postId}"
          >
            ♥ ${likes} likes
          </button>

          <span>${comments.length} comments</span>
        </div>

        <div class="post-comments">
          ${comments.slice(-3).map(comment => `
            <p>
              <strong>
                ${escapeHTML(comment.author?.username || "user")}
              </strong>
              ${escapeHTML(comment.text || "")}
            </p>
          `).join("")}
        </div>

        ${
          currentUser
            ? `
              <form class="comment-form" data-post-id="${postId}">
                <input
                  name="text"
                  type="text"
                  maxlength="500"
                  placeholder="Write a comment..."
                  required
                >
                <button type="submit">Send</button>
              </form>
            `
            : ""
        }
      </div>
    `;

    card
      .querySelector(".delete-post-button")
      ?.addEventListener("click", async event => {
        const button = event.currentTarget;

        if (!rawPostId) {
          alert("Post ID is missing. Unable to delete this post.");
          return;
        }

        const confirmed = window.confirm(
          "Are you sure you want to delete this post? This action cannot be undone."
        );

        if (!confirmed) return;

        button.disabled = true;
        button.textContent = "Deleting...";

        try {
          await API.deletePost(rawPostId);
          await loadFeed();
        } catch (error) {
          alert(error.message || "Unable to delete this post.");
          button.disabled = false;
          button.textContent = "Delete";
        }
      });

    card
      .querySelector(".post-like-button")
      ?.addEventListener("click", async event => {
        if (!currentUser) {
          window.location.href = "login.html";
          return;
        }

        const button = event.currentTarget;
        button.disabled = true;

        try {
          await API.toggleLike(rawPostId);
          await loadFeed();
        } catch (error) {
          alert(error.message || "Unable to like this post.");
        } finally {
          button.disabled = false;
        }
      });

    card
      .querySelector(".comment-form")
      ?.addEventListener("submit", async event => {
        event.preventDefault();

        const form = event.currentTarget;
        const input = form.elements.text;
        const text = input.value.trim();

        if (!text) return;

        const button = form.querySelector("button");
        button.disabled = true;

        try {
          await API.addComment(rawPostId, text);
          await loadFeed();
        } catch (error) {
          alert(error.message || "Unable to add comment.");
        } finally {
          button.disabled = false;
        }
      });

    return card;
  }

  async function loadFeed() {
    if (!feedContainer) return;

    try {
      const result = await API.getPosts();
      const posts = Array.isArray(result.posts)
        ? result.posts
        : [];

      feedContainer.replaceChildren();

      if (!posts.length) {
        const empty = document.createElement("div");
        empty.className = "loading-card";
        empty.textContent =
          "No posts yet. Be the first to share a moment!";

        feedContainer.appendChild(empty);
        return;
      }

      posts.forEach(post => {
        feedContainer.appendChild(createPostCard(post));
      });
    } catch (error) {
      feedContainer.replaceChildren();

      const message = document.createElement("p");
      message.className = "loading-card";
      message.textContent =
        error.message || "Unable to load community posts.";

      feedContainer.appendChild(message);
    }
  }

  if (createPostForm) {
    createPostForm.addEventListener("submit", async event => {
      event.preventDefault();
      clearFormMessages();

      if (!currentUser) {
        showFormMessage(
          postError,
          "Please log in before sharing a post."
        );
        return;
      }

      const file = postImage?.files?.[0] || null;
      const caption = postCaption?.value.trim() || "";

      if (!caption && !file) {
        showFormMessage(
          postError,
          "Write a thought or choose a photo before publishing."
        );
        return;
      }

      if (caption.length > 2000) {
        showFormMessage(
          postError,
          "Your thought must be 2000 characters or fewer."
        );
        return;
      }

      if (file) {
        if (file.size > 5 * 1024 * 1024) {
          showFormMessage(
            postError,
            "Your photo must be 5 MB or smaller."
          );
          return;
        }

        const allowedTypes = [
          "image/jpeg",
          "image/png",
          "image/webp",
          "image/gif"
        ];

        if (!allowedTypes.includes(file.type)) {
          showFormMessage(
            postError,
            "Choose a JPG, PNG, WEBP, or GIF image."
          );
          return;
        }
      }

      const formData = new FormData();

      if (file) {
        formData.append("image", file);
      }

      formData.append("caption", caption);

      if (publishButton) {
        publishButton.disabled = true;
        publishButton.textContent = "Publishing...";
      }

      try {
        await API.createPost(formData);

        createPostForm.reset();

        showFormMessage(
          postSuccess,
          "Your post was published successfully!"
        );

        await loadFeed();

        document
          .getElementById("feed")
          ?.scrollIntoView({ behavior: "smooth" });
      } catch (error) {
        showFormMessage(
          postError,
          error.message || "Unable to publish your post."
        );
      } finally {
        if (publishButton) {
          publishButton.disabled = false;
          publishButton.textContent = "Share post →";
        }
      }
    });
  }

  checkLogin().then(loadFeed);
});
