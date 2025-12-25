require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
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

// MongoDB Connection (optional - only needed for mandat submissions)
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✓ Connecté à MongoDB'))
  .catch(err => {
    console.warn('⚠️  MongoDB non disponible:', err.message);
    console.warn('⚠️  Le formulaire de contact fonctionnera, mais pas les soumissions de mandat');
  });

// Mongoose Schema for Mandat
const mandatSchema = new mongoose.Schema({
  uuid: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  encryptedData: {
    type: String,
    required: true
  },
  signature: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt field on save
mandatSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const Mandat = mongoose.model('Mandat', mandatSchema);

// POST endpoint - Store encrypted mandat data
app.post('/api/submit-mandat', async (req, res) => {
  try {
    // Check if MongoDB is connected
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        error: 'Service non disponible',
        message: 'La base de données n\'est pas disponible. Veuillez réessayer plus tard.'
      });
    }

    const { uuid, encryptedData, signature } = req.body;

    // Validation
    if (!uuid || !encryptedData || !signature) {
      return res.status(400).json({
        error: 'Données manquantes',
        message: 'UUID, données chiffrées et signature sont requis'
      });
    }

    console.log(`📝 Réception mandat - UUID: ${uuid}`);

    // Create new mandat (no updates allowed)
    const newMandat = new Mandat({
      uuid,
      encryptedData,
      signature
    });

    await newMandat.save();

    console.log(`✓ Nouveau mandat créé - UUID: ${uuid}`);

    // Send email notification from manda@orvanta.ca
    try {
      const mandatMailOptions = {
        from: process.env.MANDAT_MAIL_FROM || 'manda@orvanta.ca',
        to: process.env.MANDAT_MAIL_TO || process.env.MAIL_TO || 'samuel@orvanta.ca',
        subject: `Nouveau Mandat Client Reçu - UUID: ${uuid}`,
        text: `
Nouveau mandat client reçu via Orvanta.ca

UUID: ${uuid}
Date de réception: ${new Date().toLocaleString('fr-CA')}

Les données chiffrées PGP et la signature sont disponibles dans la base de données.

---
Données chiffrées (PGP):
${encryptedData}

---
Signature (base64):
${signature.substring(0, 200)}...

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
      <h3 style="color: #0b0d10;">Signature (base64 - aperçu):</h3>
      <div style="background-color: #f9f9f9; padding: 15px; border-left: 4px solid #c9a24d; font-family: monospace; font-size: 11px; word-wrap: break-word;">${signature.substring(0, 200)}...</div>
      <p style="color: #888; font-size: 12px; margin-top: 10px;">La signature complète est disponible dans la base de données.</p>
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
    } catch (emailError) {
      console.error('⚠️  Erreur lors de l\'envoi de l\'email de notification:', emailError);
      // Continue even if email fails - mandat is already saved
    }

    return res.status(201).json({
      success: true,
      message: 'Mandat enregistré avec succès',
      uuid: uuid
    });

  } catch (error) {
    console.error('✗ Erreur lors de l\'enregistrement:', error);

    if (error.code === 11000) {
      return res.status(409).json({
        error: 'Conflit',
        message: 'Ce mandat existe déjà'
      });
    }

    res.status(500).json({
      error: 'Erreur serveur',
      message: 'Erreur lors de l\'enregistrement du mandat'
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
      <div style="background-color: #f9f9f9; padding: 15px; border-left: 4px solid #c9a24d; white-space: pre-wrap;">${message}</div>
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
  console.log(`📝 Submit endpoint: http://localhost:${PORT}/api/submit-mandat`);
  console.log(`🔒 Origines autorisées: ${allowedOrigins.join(', ')}\n`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Arrêt du serveur...');
  await mongoose.connection.close();
  process.exit(0);
});
