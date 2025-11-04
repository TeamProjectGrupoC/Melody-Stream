
document.addEventListener("DOMContentLoaded", () => {

  const buttons = [
    ["test_spotify", "test_register_spotify.html"],
    ["test_podcast_upload", "podcast_upload.html"],
    ["test_login", "login.html"],
    ["test_podcast_searcher", "podcast.html"]
  ];

  buttons.forEach(([id, url]) => {
    const btn = document.getElementById(id);

    btn.addEventListener("click", () => {
      window.location.href = url;
    });
  });
});
