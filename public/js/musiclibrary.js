// musiclibrary.js
/*
* ============================================================================
* This script manages navigation to specific artist pages from the music library.
* It adds event listeners to artist elements and redirects to their respective
* pages when clicked.
* ============================================================================
*/
const botonlibreria = document.getElementById("chopin");
    botonlibreria.addEventListener("click", function() {
        window.location.href = "artistas/chopin.html";
    });

const yeaah = document.getElementById("rubinstein");
    yeaah.addEventListener("click", function() {
        window.location.href = "artistas/rubinstein.html";
    });

const uuu = document.getElementById("Quevedo");
    uuu.addEventListener("click", function() {
        window.location.href = "artistas/quevedo.html";
    });

const maria = document.getElementById("maria");
    maria.addEventListener("click", function() {
        window.location.href = "artistas/maria.html";
    });