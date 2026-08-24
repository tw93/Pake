// Wait for the DOM content to fully load before starting the delay timer
window.addEventListener('DOMContentLoaded', () => {
  // Wait 40 seconds (40,000 milliseconds) before injecting the UI button
  setTimeout(() => {
    initIskaanToggle();
  }, 40000);
});

function initIskaanToggle() {
  // Avoid duplicate creation if button is already present
  if (document.getElementById('iskaan-toggle-btn')) return;

  const button = document.createElement('button');
  button.id = 'iskaan-toggle-btn';
  button.innerText = 'Toggle View';

  // Apply fixed positioning & styling (ISKAAN color palette)
  Object.assign(button.style, {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    zIndex: '999999',
    padding: '10px 18px',
    backgroundColor: '#0D2F5F',
    color: '#FFFFFF',
    border: '2px solid #C8A24D',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)',
    transition: 'all 0.3s ease'
  });

  // Hover effect
  button.addEventListener('mouseenter', () => {
    button.style.backgroundColor = '#C8A24D';
    button.style.color = '#0D2F5F';
  });
  
  button.addEventListener('mouseleave', () => {
    button.style.backgroundColor = '#0D2F5F';
    button.style.color = '#FFFFFF';
  });

  // Toggle click action
  button.addEventListener('click', () => {
    document.body.classList.toggle('iskaan-custom-mode');
    console.log('Iskaan view toggled.');
  });

  document.body.appendChild(button);
}
