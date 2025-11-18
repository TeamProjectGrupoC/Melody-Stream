window.addEventListener('DOMContentLoaded', () => {
    const headerPic = document.getElementById('headerUserPic');
    if (!headerPic) return;

    const picUrl = localStorage.getItem('profilePic');

    if (picUrl) {
        headerPic.src = picUrl;
    } else {
        headerPic.src = "images/logos/silueta.png";
    }
});