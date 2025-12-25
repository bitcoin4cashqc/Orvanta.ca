// PGP Public Key - will be loaded from file
let PGP_PUBLIC_KEY = null;

// Load PGP Public Key from file
async function loadPGPKey() {
  try {
    const response = await fetch('public-key.asc');
    if (!response.ok) {
      throw new Error('Impossible de charger la clé publique PGP');
    }
    PGP_PUBLIC_KEY = await response.text();

    // Display in accordion
    const pgpKeyContent = document.getElementById('pgpKeyContent');
    if (pgpKeyContent) {
      pgpKeyContent.textContent = PGP_PUBLIC_KEY;
    }

    return PGP_PUBLIC_KEY;
  } catch (error) {
    console.error('Erreur lors du chargement de la clé PGP:', error);
    throw error;
  }
}

// Initialize Signature Pad
const canvas = document.getElementById('signature-pad');
const signaturePad = new SignaturePad(canvas, {
  backgroundColor: '#12151b',
  penColor: '#c9a24d'
});

// Resize canvas to fit container
function resizeCanvas() {
  const ratio = Math.max(window.devicePixelRatio || 1, 1);
  canvas.width = canvas.offsetWidth * ratio;
  canvas.height = canvas.offsetHeight * ratio;
  canvas.getContext('2d').scale(ratio, ratio);
  signaturePad.clear();
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Clear signature button
document.getElementById('clearSignature').addEventListener('click', function() {
  signaturePad.clear();
});

// Convert signature from gold to black with transparent background
function convertSignatureToTransparentBlack() {
  // Create a temporary canvas
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = canvas.width;
  tempCanvas.height = canvas.height;
  const tempCtx = tempCanvas.getContext('2d');

  // NO background fill - leave it transparent

  // Get the signature data points
  const data = signaturePad.toData();

  // Create a new signature pad on the temporary canvas with black color and transparent background
  const tempSignaturePad = new SignaturePad(tempCanvas, {
    backgroundColor: 'rgba(0,0,0,0)', // Transparent background
    penColor: '#000000'
  });

  // Redraw the signature in black
  tempSignaturePad.fromData(data);

  // Return the black signature with transparent background as PNG base64
  return tempSignaturePad.toDataURL('image/png');
}

// Generate deterministic UUID from lastname, firstname, and date of birth
async function generateDeterministicUUID(nom, prenom, dateNaissance) {
  const identifier = `${nom.toLowerCase().trim()}_${prenom.toLowerCase().trim()}_${dateNaissance}`;

  // Create SHA-256 hash
  const encoder = new TextEncoder();
  const data = encoder.encode(identifier);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  // Format as UUID (using first 32 hex chars)
  const uuid = [
    hashHex.substring(0, 8),
    hashHex.substring(8, 12),
    hashHex.substring(12, 16),
    hashHex.substring(16, 20),
    hashHex.substring(20, 32)
  ].join('-');

  return uuid;
}

// Encrypt data using PGP public key
async function encryptData(data) {
  try {
    // Ensure PGP key is loaded
    if (!PGP_PUBLIC_KEY) {
      await loadPGPKey();
    }

    const publicKey = await openpgp.readKey({ armoredKey: PGP_PUBLIC_KEY });

    const encrypted = await openpgp.encrypt({
      message: await openpgp.createMessage({ text: JSON.stringify(data) }),
      encryptionKeys: publicKey
    });

    return encrypted;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Échec du chiffrement des données');
  }
}

// Form submission
document.getElementById('mandatForm').addEventListener('submit', async function(e) {
  e.preventDefault();

  // Check if signature is empty
  if (signaturePad.isEmpty()) {
    alert('Veuillez signer le formulaire avant de le soumettre.');
    return;
  }

  try {
    console.log('=== DÉBUT DE LA SOUMISSION DU FORMULAIRE ===');

    // Get signature data (converted to black with transparent background)
    const signatureData = convertSignatureToTransparentBlack();
    console.log('✓ Signature convertie en noir avec fond transparent');

    // Get form data
    const formData = new FormData(this);
    const data = Object.fromEntries(formData.entries());
    console.log('✓ Données du formulaire collectées:', data);

    // Generate deterministic UUID from nom, prenom, dateNaissance
    const uuid = await generateDeterministicUUID(data.nom, data.prenom, data.dateNaissance);
    console.log('✓ UUID généré:', uuid);

    // Encrypt all form data (excluding signature)
    console.log('Chiffrement des données en cours...');
    const encryptedFormData = await encryptData(data);
    console.log('✓ Données chiffrées avec succès');

    // Prepare payload with encrypted data, signature, and UUID
    const payload = {
      uuid: uuid,
      encryptedData: encryptedFormData,
      signature: signatureData
    };

    console.log('\n=== DONNÉES FINALES ===');
    console.log('UUID (non chiffré):', uuid);
    console.log('Payload complet:', payload);
    console.log('\nDonnées chiffrées (PGP):\n', encryptedFormData);
    console.log('\nSignature (base64, non chiffrée - premiers 100 caractères):', signatureData.substring(0, 100) + '...');

    // Send to backend endpoint (use relative URL to work on any domain)
    const apiUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:3000/api/submit-mandat'
      : '/api/submit-mandat';

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Erreur lors de la soumission');
    }

    console.log('=== FIN DE LA SOUMISSION ===\n');
    alert('Formulaire soumis avec succès!');

    // Reset form
    this.reset();
    signaturePad.clear();

  } catch (error) {
    console.error('❌ ERREUR lors de la soumission:', error);
    console.error('Détails de l\'erreur:', error.message);
    console.error('Stack:', error.stack);
    alert('Une erreur est survenue lors de la soumission du formulaire. Consultez la console pour plus de détails.');
  }
});

// Update year in footer if needed
const yearSpan = document.getElementById('year');
if (yearSpan) {
  yearSpan.textContent = new Date().getFullYear();
}

// Accordion functionality
const accordionTrigger = document.getElementById('privacyAccordion');
const accordionContent = document.getElementById('privacyContent');

if (accordionTrigger && accordionContent) {
  accordionTrigger.addEventListener('click', function() {
    this.classList.toggle('active');
    accordionContent.classList.toggle('open');
  });
}

// Load PGP key on page load
loadPGPKey().catch(error => {
  console.error('Échec du chargement de la clé PGP:', error);
});
