document.getElementById("year").textContent = new Date().getFullYear();

document.getElementById("contactForm").addEventListener("submit", function (e) {
  e.preventDefault();
  alert("Votre demande a été soumise. Nous vous contacterons sous peu.");
  this.reset();
});
