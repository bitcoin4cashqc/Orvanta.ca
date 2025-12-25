require('dotenv').config();
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

// Configure allowed origins
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : ['http://localhost:3000', 'http://127.0.0.1:3000'];

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, Postman)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn(`⚠️  Origine non autorisée: ${origin}`);
      callback(new Error('Non autorisé par CORS'));
    }
  },
  credentials: true
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' })); // Increased limit for base64 signatures

// Nodemailer Configuration
const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST ,
  port: parseInt(process.env.MAIL_PORT),
  secure: true, // true = 465, false = 587
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASSWORD
  }
});

// Verify transporter configuration
transporter.verify(function(error, success) {
  if (error) {
    console.warn('⚠️  Erreur de configuration email:', error.message);
  } else {
    console.log('✓ Serveur email prêt');
  }
});

// POST endpoint - Submit mandat and send email
app.post('/api/submit-mandat', async (req, res) => {
  try {
    const { uuid, encryptedData, signature } = req.body;

    // Validation
    if (!uuid || !encryptedData || !signature) {
      return res.status(400).json({
        error: 'Données manquantes',
        message: 'UUID, données chiffrées et signature sont requis'
      });
    }

    console.log(`📝 Réception mandat - UUID: ${uuid}`);

    // Convert base64 signature to buffer for email attachment
    const signatureBuffer = Buffer.from(signature.split(',')[1], 'base64');

    // Send email notification from manda@orvanta.ca
    try {
      const mandatMailOptions = {
        from: process.env.MANDAT_MAIL_FROM || 'manda@orvanta.ca',
        to: process.env.MANDAT_MAIL_TO || process.env.MAIL_TO || 'samuel@orvanta.ca',
        subject: `Nouveau Mandat Client Reçu - UUID: ${uuid}`,
        attachments: [
          {
            filename: `signature_${uuid}.png`,
            content: signatureBuffer,
            contentType: 'image/png',
            cid: `signature_${uuid}` // Content-ID for embedding in HTML
          }
        ],
        text: `
Nouveau mandat client reçu via Orvanta.ca

UUID: ${uuid}
Date de réception: ${new Date().toLocaleString('fr-CA')}

Les données chiffrées PGP et la signature sont disponibles dans la base de données.

---
Données chiffrées (PGP):
${encryptedData}

---
Signature:
✓ Voir la pièce jointe PNG (signature_${uuid}.png)
✓ Fond transparent - Prête pour intégration PDF

Envoyé le ${new Date().toLocaleString('fr-CA')}
        `,
        html: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
  <div style="background-color: #0b0d10; color: #c9a24d; padding: 20px; text-align: center;">
    <h2 style="margin: 0;">Nouveau Mandat Client - Orvanta</h2>
  </div>

  <div style="background-color: white; padding: 30px; margin-top: 20px; border: 1px solid #ddd;">
    <h3 style="color: #0b0d10; margin-top: 0;">Informations du mandat</h3>

    <table style="width: 100%; border-collapse: collapse;">
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 10px 0; font-weight: bold; color: #555;">UUID:</td>
        <td style="padding: 10px 0; font-family: monospace;">${uuid}</td>
      </tr>
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 10px 0; font-weight: bold; color: #555;">Date de réception:</td>
        <td style="padding: 10px 0;">${new Date().toLocaleString('fr-CA')}</td>
      </tr>
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 10px 0; font-weight: bold; color: #555;">Statut:</td>
        <td style="padding: 10px 0;"><span style="background-color: #4CAF50; color: white; padding: 5px 10px; border-radius: 3px;">Enregistré</span></td>
      </tr>
    </table>

    <div style="margin-top: 30px;">
      <h3 style="color: #0b0d10;">Données chiffrées (PGP):</h3>
      <div style="background-color: #f9f9f9; padding: 15px; border-left: 4px solid #c9a24d; font-family: monospace; font-size: 11px; max-height: 300px; overflow-y: auto; word-wrap: break-word;">${encryptedData}</div>
    </div>

    <div style="margin-top: 30px;">
      <h3 style="color: #0b0d10;">Signature:</h3>
      <div style="background-color: #f9f9f9; padding: 15px; border-left: 4px solid #c9a24d;">
        <img src="cid:signature_${uuid}" alt="Signature" style="max-width: 100%; height: auto; border: 1px solid #ddd;" />
      </div>
      <p style="color: #888; font-size: 12px; margin-top: 10px;">✓ Signature en pièce jointe (PNG transparent) - Prête pour intégration PDF</p>
    </div>

    <div style="margin-top: 30px; padding: 15px; background-color: #fff3cd; border-left: 4px solid #ffc107;">
      <p style="margin: 0; color: #856404;">
        <strong>Note:</strong> Les données du formulaire sont chiffrées avec PGP. Utilisez votre clé privée pour les déchiffrer.
      </p>
    </div>

    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #888; font-size: 12px;">
      <p>Envoyé le ${new Date().toLocaleString('fr-CA')}</p>
    </div>
  </div>
</div>
        `
      };

      await transporter.sendMail(mandatMailOptions);
      console.log(`✓ Email de notification envoyé depuis ${process.env.MANDAT_MAIL_FROM || 'manda@orvanta.ca'}`);

      return res.status(200).json({
        success: true,
        message: 'Mandat soumis avec succès',
        uuid: uuid
      });

    } catch (emailError) {
      console.error('⚠️  Erreur lors de l\'envoi de l\'email:', emailError);
      return res.status(500).json({
        error: 'Erreur serveur',
        message: 'Erreur lors de l\'envoi du mandat'
      });
    }

  } catch (error) {
    console.error('✗ Erreur lors du traitement:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      message: 'Erreur lors du traitement du mandat'
    });
  }
});

// POST endpoint - Contact form
app.post('/api/contact', async (req, res) => {
  try {
    const { nom, email, telephone, message } = req.body;

    // Validation
    if (!nom || !email || !telephone) {
      return res.status(400).json({
        error: 'Données manquantes',
        message: 'Nom, email et téléphone sont requis'
      });
    }

    console.log(`📧 Réception formulaire de contact - De: ${email}`);

    // Prepare email
    const mailOptions = {
      from: process.env.MAIL_FROM || 'contact@orvanta.ca',
      to: process.env.MAIL_TO || 'samuel@orvanta.ca',
      subject: `Nouveau contact depuis Orvanta.ca - ${nom}`,
      text: `
Nouveau message de contact depuis le site Orvanta.ca

Nom: ${nom}
Email: ${email}
Téléphone: ${telephone}

Message:
${message || '(Aucun message fourni)'}

---
Envoyé le ${new Date().toLocaleString('fr-CA')}
      `,
      html: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
  <div style="background-color: #0b0d10; color: #c9a24d; padding: 20px; text-align: center;">
    <h2 style="margin: 0;">Nouveau Contact - Orvanta</h2>
  </div>

  <div style="background-color: white; padding: 30px; margin-top: 20px; border: 1px solid #ddd;">
    <h3 style="color: #0b0d10; margin-top: 0;">Informations du contact</h3>

    <table style="width: 100%; border-collapse: collapse;">
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 10px 0; font-weight: bold; color: #555;">Nom:</td>
        <td style="padding: 10px 0;">${nom}</td>
      </tr>
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 10px 0; font-weight: bold; color: #555;">Email:</td>
        <td style="padding: 10px 0;"><a href="mailto:${email}" style="color: #c9a24d;">${email}</a></td>
      </tr>
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 10px 0; font-weight: bold; color: #555;">Téléphone:</td>
        <td style="padding: 10px 0;"><a href="tel:${telephone}" style="color: #c9a24d;">${telephone}</a></td>
      </tr>
    </table>

    ${message ? `
    <div style="margin-top: 30px;">
      <h3 style="color: #0b0d10;">Message:</h3>
      <div id="pgp" style="background-color: #f9f9f9; padding: 15px; border-left: 4px solid #c9a24d; white-space: pre-wrap;">${message}</div>
    </div>
    ` : ''}

    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #888; font-size: 12px;">
      <p>Envoyé le ${new Date().toLocaleString('fr-CA')}</p>
    </div>
  </div>
</div>
      `
    };

    // Send email
    await transporter.sendMail(mailOptions);

    console.log(`✓ Email envoyé à ${process.env.MAIL_TO}`);
    return res.status(200).json({
      success: true,
      message: 'Message envoyé avec succès'
    });

  } catch (error) {
    console.error('✗ Erreur lors de l\'envoi de l\'email:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      message: 'Erreur lors de l\'envoi du message'
    });
  }
});


// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Serveur démarré sur le port ${PORT}`);
  console.log(`📧 Contact endpoint: http://localhost:${PORT}/api/contact`);
  console.log(`📝 Mandat endpoint: http://localhost:${PORT}/api/submit-mandat`);
  console.log(`🔒 Origines autorisées: ${allowedOrigins.join(', ')}\n`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Arrêt du serveur...');
  process.exit(0);
});
