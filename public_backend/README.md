# Orvanta Public Backend API

Backend Node.js public pour recevoir les soumissions de mandats clients avec chiffrement PGP.

## Installation

1. Installer les dépendances :
```bash
cd public_backend
npm install
```

2. Configurer les variables d'environnement dans `.env` :
```env
# MongoDB
MONGODB_URI=mongodb://localhost:27017/orvanta

# Server
PORT=3000

# CORS Origins
ALLOWED_ORIGINS=http://localhost:8080,http://127.0.0.1:8080,https://orvanta.ca,https://www.orvanta.ca

# Email Configuration
MAIL_HOST=mail.privateemail.com
MAIL_PORT=587
MAIL_USER=contact@orvanta.ca
MAIL_PASSWORD=your_password_here
MAIL_FROM=contact@orvanta.ca
MAIL_TO=samuel@orvanta.ca
```

**Notes:**
- Modifiez `ALLOWED_ORIGINS` pour inclure uniquement les domaines autorisés à soumettre des formulaires
- Ajustez le port local selon votre serveur de développement (8080, 5500, etc.)
- **Configurez impérativement** `MAIL_PASSWORD` avec votre mot de passe email réel
- `MAIL_TO` est l'adresse qui recevra les emails du formulaire de contact

3. Démarrer MongoDB (si local) :
```bash
mongod
```

4. Démarrer le serveur :
```bash
npm start
```

Pour le développement avec auto-reload :
```bash
npm run dev
```

## Endpoints

### 📧 POST `/api/contact`
Envoie un email avec les informations du formulaire de contact.

**Protection:** Seules les origines configurées dans `ALLOWED_ORIGINS` peuvent soumettre.

**Body:**
```json
{
  "nom": "Samuel Millette",
  "email": "test@example.com",
  "telephone": "514-555-1234",
  "message": "Brève description du cas (optionnel)"
}
```

**Réponse (200 OK):**
```json
{
  "success": true,
  "message": "Message envoyé avec succès"
}
```

**Réponse (400 Bad Request):**
```json
{
  "error": "Données manquantes",
  "message": "Nom, email et téléphone sont requis"
}
```

### 📝 POST `/api/submit-mandat`
Enregistre un nouveau mandat. **Une seule soumission par UUID est autorisée** (pas de mise à jour possible).

**Protection:** Seules les origines configurées dans `ALLOWED_ORIGINS` peuvent soumettre.

**Body:**
```json
{
  "uuid": "abc123-def456-...",
  "encryptedData": "-----BEGIN PGP MESSAGE-----...",
  "signature": "data:image/png;base64,..."
}
```

**Réponse (201 Created):**
```json
{
  "success": true,
  "message": "Mandat enregistré avec succès",
  "uuid": "abc123-def456-..."
}
```

**Réponse (409 Conflict) si UUID existe déjà:**
```json
{
  "error": "Conflit",
  "message": "Ce mandat existe déjà"
}
```

### 💚 GET `/api/health`
Vérifie l'état du serveur et de MongoDB.

**Réponse (200 OK):**
```json
{
  "status": "OK",
  "mongodb": "Connecté",
  "timestamp": "2025-12-23T..."
}
```

## Fonctionnalités

### Email (Nodemailer)
- Envoi d'emails via le formulaire de contact
- Configuration SMTP personnalisable via `.env`
- Templates HTML élégants avec le branding Orvanta
- Vérification de la configuration au démarrage du serveur

### Formulaire de Mandat
- Stockage sécurisé des mandats clients
- Chiffrement PGP end-to-end
- UUID déterministe pour retrouver les données

## Sécurité

- **Chiffrement PGP** : Toutes les données du formulaire de mandat sont chiffrées côté client avant l'envoi
- **Protection CORS** : Seules les origines configurées dans `ALLOWED_ORIGINS` peuvent soumettre des données
- **UUID déterministe** : Généré à partir de nom + prénom + date de naissance (SHA-256)
- **Données write-only** : Ce backend ne permet que l'écriture, pas la lecture (pour la sécurité)
- **Une soumission unique** : Chaque UUID ne peut être enregistré qu'une seule fois (pas de mise à jour)
- **Signatures non chiffrées** : Stockées en base64 (converties en noir côté client)
- **Emails sécurisés** : Connexion SMTP avec authentification (TLS sur port 587)

## Structure MongoDB

Collection: `mandats`

```javascript
{
  uuid: String (unique, indexed),
  encryptedData: String (données PGP),
  signature: String (base64),
  createdAt: Date,
  updatedAt: Date
}
```

## Récupération des données

Les données ne sont **pas** accessibles via ce backend public pour des raisons de sécurité.

L'accès aux données chiffrées doit se faire directement via MongoDB avec les permissions appropriées, ou via un backend administrateur séparé et sécurisé.

### Déchiffrement des données

Les données peuvent être déchiffrées avec la clé privée PGP correspondante :

```bash
# Avec GPG
echo "-----BEGIN PGP MESSAGE-----..." | gpg --decrypt

# Avec OpenPGP.js (Node.js)
const openpgp = require('openpgp');

const decrypted = await openpgp.decrypt({
  message: await openpgp.readMessage({ armoredMessage: encryptedData }),
  decryptionKeys: privateKey
});

console.log(JSON.parse(decrypted.data));
```

## Notes

### Formulaires de Mandat
- Le UUID est généré de manière déterministe : même identité = même UUID
- **Une seule soumission par UUID** : Les mandats ne peuvent pas être mis à jour une fois enregistrés
- Ce backend est **write-only** : il accepte uniquement les soumissions
- Pour la récupération sécurisée des données, créez un backend admin séparé
- La signature est conservée en noir (convertie depuis l'or côté client)

### Formulaire de Contact
- Les emails sont envoyés directement via SMTP (pas de stockage en base de données)
- Template HTML responsive avec le branding Orvanta (noir #0b0d10 et or #c9a24d)
- Le serveur vérifie la configuration email au démarrage

### Sécurité Générale
- Seules les origines définies dans `ALLOWED_ORIGINS` peuvent soumettre des formulaires
- Protection CORS active sur tous les endpoints
