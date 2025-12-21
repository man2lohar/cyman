// header.js

// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
    const headerPlaceholder = document.getElementById('header-placeholder');
    
    // Load the header content (either via fetch or direct insertion)
    fetch('../../public/header.html')
        .then(response => response.text())
        .then(data => {
            // Insert the content of header.html into the placeholder
            headerPlaceholder.innerHTML = data;
            
            // Now that the header content is loaded, run the initialization for your buttons
            initializeButtons();
        })
        .catch(error => {
            console.error('Error loading header:', error);
        });
});

// Function to initialize button event listeners
function initializeButtons() {
    const container = document.getElementById('login-container');
    const backdrop = document.getElementById('backdrop');
    const toSignup = document.getElementById('toSignup');
    const toLogin = document.getElementById('toLogin');
    const closeIcon = document.getElementById('closeIcon');
    const openSignIn = document.getElementById('openSignIn');
    const openSignUp = document.getElementById('openSignUp');

    // Helper functions for scroll management
    const disableScroll = () => document.body.style.overflow = 'hidden';
    const enableScroll = () => document.body.style.overflow = '';

    if (container && backdrop && toSignup && toLogin && closeIcon && openSignIn && openSignUp) {
        // Switch to Signup form
        toSignup.addEventListener('click', (e) => {
            e.preventDefault();
            container.classList.add('active');
        });

        // Switch to Login form
        toLogin.addEventListener('click', (e) => {
            e.preventDefault();
            container.classList.remove('active');
        });

        // Open modal with Login form
        openSignIn.addEventListener('click', () => {
            container.classList.remove('active'); // Ensure Login form is shown
            container.classList.add('show');
            backdrop.classList.add('show');
            disableScroll();
        });

        // Open modal with Signup form
        openSignUp.addEventListener('click', () => {
            container.classList.add('active'); // Ensure Signup form is shown
            container.classList.add('show');
            backdrop.classList.add('show');
            disableScroll();
        });

        // Close modal
        closeIcon.addEventListener('click', () => {
            container.classList.remove('show');
            backdrop.classList.remove('show');
            enableScroll();
        });
    } else {
        console.error('One or more required elements are missing.');
    }
}
