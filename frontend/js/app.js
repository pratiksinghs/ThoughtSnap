
document.addEventListener("DOMContentLoaded", () => {
  const feedContainer = document.getElementById("feed-container");
  const createPostForm = document.getElementById("create-post-form");
  const loginPrompt = document.getElementById("composer-login-prompt");
  const postImage = document.getElementById("post-image");
  const postCaption = document.getElementById("post-caption");
  const postError = document.getElementById("post-form-error");
  const postSuccess = document.getElementById("post-form-success");
  const publishButton = document.getElementById("publish-post-button");
  const navActions = document.getElementById("nav-actions");
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

  async function checkLogin() {
    try {
      const result = await API.getMe();
      currentUser = result.user || null;
    } catch {
      currentUser = null;
    }

    if (createPostForm) {
      createPostForm.hidden = !currentUser;
    }

    if (loginPrompt) {
      loginPrompt.hidden = Boolean(currentUser);
    }

    if (navActions && currentUser) {
      navActions.innerHTML = `
        <a class="btn btn-light" href="profile.html">My profile</a>
        <button class="btn btn-primary" id="logout-button" type="button">
          Log out
        </button>
      `;

      document
        .getElementById("logout-button")
        ?.addEventListener("click", async () => {
          try {
            await API.logout();
            window.location.reload();
          } catch (error) {
            alert(error.message || "Unable to log out.");
          }
        });
    }
  }

  function createPostCard(post) {
    const author = post.author || {};
    const authorName = escapeHTML(author.name || "ThoughtSnap user");
    const username = escapeHTML(author.username || "user");
    const caption = escapeHTML(post.caption || "");
    const imageUrl = escapeHTML(post.imageUrl || "");

    const likes = Array.isArray(post.likes)
      ? post.likes.length
      : Number(post.likesCount || 0);

    const comments = Array.isArray(post.comments)
      ? post.comments
      : [];

    const postId = escapeHTML(post.id || post._id || "");

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
      .querySelector(".post-like-button")
      ?.addEventListener("click", async event => {
        if (!currentUser) {
          window.location.href = "login.html";
          return;
        }

        const button = event.currentTarget;
        button.disabled = true;

        try {
          await API.toggleLike(post.id || post._id);
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
          await API.addComment(post.id || post._id, text);
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

      // Allow text-only posts and photo posts.
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

      // Validate the image only when a photo was selected.
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

      // Send the image only if one was selected.
      if (file) {
        formData.append("image", file);
      }

      formData.append("caption", caption);

      if (publishButton) {
        publishButton.disabled = true;
        publishButton.textContent = "Ho Raha hai wait karo ...";
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
