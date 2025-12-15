// musiclibrary.js
/*
* ============================================================================
* This script manages navigation to specific artist pages from the music library.
* It adds event listeners to artist elements and redirects to their respective
* pages when clicked.
* ============================================================================
*/
const chopinLib = document.getElementById("chopin");
    chopinLib.addEventListener("click", function() {
        window.location.href = "artistas/chopin.html";
    });

const quevedoLib = document.getElementById("Quevedo");
    quevedoLib.addEventListener("click", function() {
        window.location.href = "artistas/quevedo.html";
    });

const mariaLib = document.getElementById("maria");
    mariaLib.addEventListener("click", function() {
        window.location.href = "artistas/maria.html";
    });