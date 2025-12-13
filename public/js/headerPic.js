// headerPic.js
/*
* ============================================================================
* This script manages the user's profile picture displayed in the header.
* It retrieves the profile picture URL from localStorage and updates the
* header image accordingly. If no profile picture is found, it defaults to
* a placeholder image.
* ============================================================================
*/
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