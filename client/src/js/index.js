// Particle Background (for visual effect)
const particles = document.querySelector('.particles');
for (let i = 0; i < 100; i++) {
    const particle = document.createElement('div');
    particle.className = 'particle';
    particle.style.width = particle.style.height = `${Math.random() * 5 + 2}px`;
    particle.style.top = `${Math.random() * 100}vh`;
    particle.style.left = `${Math.random() * 100}vw`;
    particle.style.animation = `float ${Math.random() * 5 + 3}s infinite ease-in-out`;
    particles.appendChild(particle);
}


document.querySelectorAll('nav a').forEach(link => {
    link.addEventListener('click', function (e) {
        e.preventDefault(); // Prevent default anchor behavior

        const targetId = this.getAttribute('href');
        const targetSection = document.querySelector(targetId);

        // Get the section's position relative to the viewport
        const sectionTop = targetSection.getBoundingClientRect().top;
        const offsetPosition = window.scrollY + sectionTop - (window.innerHeight / 2 - targetSection.offsetHeight / 2);

        // Smoothly scroll to the position
        window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
        });
    });
});

const text = "Your Portal to Building Fast ...";
    const typingEffect = document.querySelector(".typing-effect");
    let index = 0;

    function typeCharacter() {
      if (index < text.length) {
        typingEffect.textContent += text[index];
        index++;
        setTimeout(typeCharacter, 100); // Typing speed: 100ms per character
      } else {
        setTimeout(clearText, 2000); // Wait 2 seconds before clearing
      }
    }

    function clearText() {
      typingEffect.textContent = "";
      index = 0;
      setTimeout(typeCharacter, 500); // Restart typing after a short delay
    }

    typeCharacter();