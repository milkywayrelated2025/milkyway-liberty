# 🚀 Version de Référence - API Fusion Vidéo

## 📅 Date de sauvegarde
**Date :** $(date)
**Commit Git :** $(git rev-parse HEAD)

## ✅ Fonctionnalités de cette version

### 🔧 Système de sessions
- Chaque session a un ID unique
- Isolation des fichiers par session
- Nettoyage automatique après fusion

### 🗑️ Nettoyage automatique
- ✅ Suppression des vidéos originales après fusion
- ✅ Suppression des fichiers temporaires
- ✅ Conservation uniquement du fichier de sortie final
- ✅ Suppression des anciens outputs de la même session

### 🎯 API Endpoints
- `POST /upload?sessionId=xxx` - Upload avec sessionId
- `POST /merge` - Fusion avec sessionId dans le body
- `DELETE /cleanup` - Nettoyage manuel
- `GET /health` - Statut de l'API

### 🎬 Interface Web
- Interface HTML moderne
- Génération automatique de sessionId
- Upload drag & drop
- Fusion en un clic

## 📁 Structure des fichiers
```
milkyway liberty /
├── server.js              # API principale
├── test-optimized.html    # Interface web
├── package.json           # Dépendances
├── quick-test.js          # Scripts de test
├── test-duration.js       # Vérification durée
└── videos/               # Dossier des vidéos
```

## 🔑 Configuration
- **Port :** 3000
- **API Key :** supersecretkey
- **FFmpeg :** /usr/local/bin/ffmpeg
- **Limite upload :** 100MB par fichier

## 🚀 Pour démarrer
```bash
npm start
```

## 📝 Pour revenir à cette version
```bash
# Option 1: Git
git checkout <commit-hash>

# Option 2: Restaurer la sauvegarde
cp -r ../milkyway-liberty-backup-YYYYMMDD-HHMMSS/* .
```

---
**Note :** Cette version est stable et fonctionnelle avec nettoyage automatique des fichiers. 