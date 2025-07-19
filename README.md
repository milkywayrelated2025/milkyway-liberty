# 🎬 API Fusion Vidéo - Milkyway Liberty

Une API Node.js moderne pour fusionner des vidéos avec progression en temps réel et interface web intuitive.

## ✨ Fonctionnalités

### 🚀 API Backend
- **Fusion de vidéos** avec FFmpeg
- **Progression en temps réel** via WebSocket
- **Système de sessions** avec nettoyage automatique
- **Validation des vidéos** avant traitement
- **Normalisation conditionnelle** (résolution, codec, framerate)
- **Gestion d'erreurs** robuste avec fallback

### 🎯 Interface Web
- **Interface moderne** avec drag & drop
- **Barre de progression** en temps réel
- **Connexion WebSocket** automatique
- **Messages d'état** détaillés
- **Téléchargement direct** des résultats

### 🔧 Fonctionnalités Avancées
- **Nettoyage automatique** des fichiers temporaires
- **Isolation par session** pour éviter les conflits
- **Support multi-format** (MP4, MOV, AVI)
- **Limite de taille** configurable (100MB par défaut)
- **API sécurisée** avec clé d'authentification

## 🛠️ Installation

### Prérequis
- Node.js (v16+)
- FFmpeg installé sur le système
- Git

### Installation
```bash
# Cloner le repository
git clone https://github.com/votre-username/milkyway-liberty.git
cd milkyway-liberty

# Installer les dépendances
npm install

# Créer le fichier .env (optionnel)
cp .env.example .env
# Éditer .env avec vos configurations

# Démarrer le serveur
npm start
```

## 📁 Structure du Projet

```
milkyway-liberty/
├── server.js              # API principale
├── test-optimized.html    # Interface web
├── package.json           # Dépendances
├── .env.example          # Configuration exemple
├── .gitignore            # Fichiers ignorés
├── README.md             # Documentation
├── VERSION_REFERENCE.md  # Référence de version
└── videos/               # Dossier des vidéos (créé automatiquement)
```

## 🔧 Configuration

### Variables d'environnement (.env)
```env
PORT=3000
API_KEY=supersecretkey
FFMPEG_PATH=/usr/local/bin/ffmpeg
```

### Configuration par défaut
- **Port :** 3000
- **API Key :** supersecretkey
- **FFmpeg :** /usr/local/bin/ffmpeg
- **Limite upload :** 100MB par fichier

## 🚀 Utilisation

### 1. Démarrer le serveur
```bash
npm start
```

### 2. Ouvrir l'interface web
Ouvrez `test-optimized.html` dans votre navigateur ou accédez à :
```
http://localhost:3000/test-optimized.html
```

### 3. Utiliser l'API
```bash
# Upload d'une vidéo
curl -X POST http://localhost:3000/upload \
  -H "x-api-key: supersecretkey" \
  -F "video=@video.mp4" \
  -F "sessionId=123"

# Fusion des vidéos
curl -X POST http://localhost:3000/merge \
  -H "x-api-key: supersecretkey" \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "123", "socketId": "socket-id"}'
```

## 📊 API Endpoints

### POST /upload
Upload d'une vidéo avec sessionId
```bash
POST /upload?sessionId=123
Headers: x-api-key: supersecretkey
Body: multipart/form-data (video file)
```

### POST /merge
Fusion des vidéos d'une session
```bash
POST /merge
Headers: 
  x-api-key: supersecretkey
  Content-Type: application/json
Body: {"sessionId": "123", "socketId": "socket-id"}
```

### DELETE /cleanup
Nettoyage manuel des fichiers temporaires
```bash
DELETE /cleanup
Headers: x-api-key: supersecretkey
```

### GET /health
Statut de l'API
```bash
GET /health
```

## 🔌 WebSocket Events

### merge-progress
Événement de progression de fusion
```javascript
socket.on('merge-progress', (data) => {
  console.log(data);
  // {
  //   progress: 45,
  //   currentTime: 30,
  //   totalDuration: 67,
  //   remainingTime: 37,
  //   eta: "00:00:37",
  //   stage: "fusion",
  //   message: "Fusion en cours... 45% (00:00:37 restant)"
  // }
});
```

## 🎯 Fonctionnalités Techniques

### Système de Sessions
- Chaque session a un ID unique
- Isolation complète des fichiers
- Nettoyage automatique après fusion

### Progression en Temps Réel
- Parsing de la sortie FFmpeg
- Calcul du pourcentage et ETA
- Communication WebSocket
- Interface utilisateur réactive

### Gestion d'Erreurs
- Validation des vidéos avant traitement
- Fallback automatique (copy → re-encode)
- Messages d'erreur détaillés
- Nettoyage en cas d'échec

## 🔒 Sécurité

- **API Key** requise pour tous les endpoints
- **Validation** des fichiers uploadés
- **Limite de taille** configurable
- **Isolation** des sessions utilisateurs

## 🚀 Déploiement

### Railway
Le projet inclut `railway.json` pour déploiement automatique sur Railway.

### Autres plateformes
```bash
# Build pour production
npm run build

# Variables d'environnement requises
PORT=3000
API_KEY=votre_cle_secrete
FFMPEG_PATH=/usr/local/bin/ffmpeg
```

## 🤝 Contribution

1. Fork le projet
2. Créer une branche feature (`git checkout -b feature/AmazingFeature`)
3. Commit les changements (`git commit -m 'Add some AmazingFeature'`)
4. Push vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrir une Pull Request

## 📝 Licence

Ce projet est sous licence MIT. Voir le fichier `LICENSE` pour plus de détails.

## 🙏 Remerciements

- **FFmpeg** pour le traitement vidéo
- **Socket.IO** pour la communication temps réel
- **Express.js** pour l'API REST
- **Multer** pour la gestion des uploads

---

**Développé avec ❤️ pour la fusion vidéo moderne**