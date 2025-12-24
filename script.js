document.getElementById("year").textContent = new Date().getFullYear();

document.getElementById("contactForm").addEventListener("submit", async function (e) {
  e.preventDefault();

  // Get form data
  const formData = new FormData(this);
  const data = Object.fromEntries(formData.entries());

  // Get submit button
  const submitButton = this.querySelector('button[type="submit"]');
  const originalText = submitButton.textContent;

  try {
    // Disable button and show loading state
    submitButton.disabled = true;
    submitButton.textContent = 'Envoi en cours...';

    // Send to backend (use relative URL to work on any domain)
    const apiUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:3000/api/contact'
      : '/api/contact';

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Erreur lors de l\'envoi');
    }

    // Success
    alert("Votre demande a été soumise avec succès. Nous vous contacterons sous peu.");
    this.reset();

  } catch (error) {
    console.error('Erreur:', error);
    alert('Une erreur est survenue lors de l\'envoi du formulaire. Veuillez réessayer.');
  } finally {
    // Re-enable button
    submitButton.disabled = false;
    submitButton.textContent = originalText;
  }
});
