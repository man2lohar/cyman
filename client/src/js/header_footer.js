// Function to load an external HTML file into a specific element
function loadHTML(id, url) {
    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Failed to load ${url}`);
            }
            return response.text();
        })
        .then(html => {
            document.getElementById(id).innerHTML = html;
        })
        .catch(error => {
            console.error('Error:', error);
        });
}

// Load the header and footer dynamically on both pages
loadHTML('header-placeholder', '../../public/header.html');
loadHTML('footer-placeholder', '../../public/footer.html');
