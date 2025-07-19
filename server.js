require('dotenv').config(); // Charge .env

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { exec, spawn } = require('child_process');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Configuration avec support Railway
const PORT = process.env.PORT || process.env.RAILWAY_STATIC_URL_PORT || 3000;
const API_KEY = process.env.API_KEY || 'supersecretkey';
const FFMPEG_PATH = process.env.FFMPEG_PATH || '/usr/bin/ffmpeg';
const MAX_FILE_SIZE = process.env.MAX_FILE_SIZE || 104857600; // 100MB
const CLEANUP_TTL = process.env.CLEANUP_TTL || 7200000; // 2h

// Configuration
const videosDir = path.join(__dirname, 'videos');
const ffmpegPath = process.env.FFMPEG_PATH || '/usr/local/bin/ffmpeg'; // Pour Railway ou local
const ffprobePath = ffmpegPath.replace('ffmpeg', 'ffprobe');

// Middleware
app.use(cors());
app.use(express.json());
app.use('/videos', express.static(videosDir));

// Servir les fichiers statiques (HTML, CSS, JS)
app.use(express.static(__dirname));

// Créer le dossier videos s'il n'existe pas
if (!fs.existsSync(videosDir)) {
  fs.mkdirSync(videosDir);
}

// Validation et extraction métadonnées avec ffprobe
async function validateVideo(filePath) {
  return new Promise((resolve, reject) => {
    // Validation basique
    const validateCommand = `${ffmpegPath} -v error -i "${filePath}" -f null -`;
    exec(validateCommand, { timeout: 10000 }, (error) => {
      if (error) {
        return reject({ isValid: false, error: error.message });
      }

      // Extraction métadonnées en JSON
      const ffprobeCommand = `${ffprobePath} -v quiet -print_format json -show_streams -show_format "${filePath}"`;
      exec(ffprobeCommand, (err, stdout) => {
        if (err) {
          return reject({ isValid: false, error: 'Erreur ffprobe' });
        }

        try {
          const data = JSON.parse(stdout);
          const videoStream = data.streams.find(s => s.codec_type === 'video');
          const audioStream = data.streams.find(s => s.codec_type === 'audio');

          if (!videoStream) {
            return reject({ isValid: false, error: 'Pas de stream vidéo' });
          }

          const duration = parseFloat(data.format.duration) || 0;
          const resolution = videoStream ? `${videoStream.width}x${videoStream.height}` : 'unknown';
          const framerate = videoStream ? videoStream.r_frame_rate : 'unknown';
          const videoCodec = videoStream ? videoStream.codec_name : 'unknown';
          const audioCodec = audioStream ? audioStream.codec_name : 'unknown';

          resolve({
            isValid: true,
            duration,
            resolution,
            framerate,
            videoCodec,
            audioCodec,
            fileSize: fs.statSync(filePath).size
          });
        } catch (parseErr) {
          reject({ isValid: false, error: 'Erreur parsing ffprobe' });
        }
      });
    });
  });
}

// Vérifier si normalisation nécessaire
function needsNormalization(metadata) {
  const target = {
    resolution: '1920x1080',
    videoCodec: 'h264',
    audioCodec: 'aac',
    framerate: '30/1'
  };

  return (
    metadata.resolution !== target.resolution ||
    metadata.videoCodec !== target.videoCodec ||
    metadata.audioCodec !== target.audioCodec ||
    metadata.framerate !== target.framerate
  );
}

// Parsing erreurs FFmpeg
function parseFFmpegError(stderr) {
  if (stderr.includes('Invalid data')) return 'Fichier corrompu';
  if (stderr.includes('No such file')) return 'Fichier manquant';
  if (stderr.includes('timeout')) return 'Timeout';
  if (stderr.includes('Codec not supported')) return 'Codec incompatible';
  return stderr || 'Erreur inconnue';
}

// Parser la progression FFmpeg
function parseFFmpegProgress(stderr) {
  const timeMatch = stderr.match(/time=(\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
  const durationMatch = stderr.match(/Duration: (\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
  
  if (timeMatch && durationMatch) {
    const currentTime = parseInt(timeMatch[1]) * 3600 + parseInt(timeMatch[2]) * 60 + parseInt(timeMatch[3]) + parseInt(timeMatch[4]) / 100;
    const totalDuration = parseInt(durationMatch[1]) * 3600 + parseInt(durationMatch[2]) * 60 + parseInt(durationMatch[3]) + parseInt(durationMatch[4]) / 100;
    
    const progress = Math.min((currentTime / totalDuration) * 100, 100);
    const remainingTime = totalDuration - currentTime;
    
    return {
      progress: Math.round(progress),
      currentTime: Math.round(currentTime),
      totalDuration: Math.round(totalDuration),
      remainingTime: Math.round(remainingTime),
      eta: formatTime(remainingTime)
    };
  }
  
  return null;
}

// Formater le temps en HH:MM:SS
function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Nettoyage auto (TTL 2h)
function cleanupOldFiles() {
  const TTL = 2 * 60 * 60 * 1000;
  const now = Date.now();
  fs.readdirSync(videosDir).forEach(file => {
    const filePath = path.join(videosDir, file);
    const stats = fs.statSync(filePath);
    if (now - stats.mtimeMs > TTL && !file.startsWith('output_')) { // Garde les outputs plus longtemps si besoin
      fs.unlinkSync(filePath);
      console.log(`🗑️ Supprimé: ${file}`);
    }
  });
}
setInterval(cleanupOldFiles, 30 * 60 * 1000);

// Cleanup session files (supprime inputs et temp pour une session, garde output)
function cleanupSession(sessionId) {
  fs.readdirSync(videosDir).forEach(file => {
    if (file.startsWith(`video_${sessionId}_`) || file.startsWith(`norm_${sessionId}_`) || file.startsWith(`filelist_${sessionId}_`)) {
      const filePath = path.join(videosDir, file);
      fs.unlinkSync(filePath);
      console.log(`🗑️ Session supprimé: ${file}`);
    }
  });
}

// Upload endpoint (avec sessionId)
app.post('/upload', async (req, res) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== API_KEY) return res.status(401).json({ error: 'Clé API invalide' });

  const sessionId = req.query.sessionId;
  if (!sessionId) return res.status(400).json({ error: 'sessionId requis' });

  const storage = multer.diskStorage({
    destination: videosDir,
    filename: (req, file, cb) => cb(null, `video_${sessionId}_${Date.now()}${path.extname(file.originalname)}`)
  });

  const upload = multer({ storage, limits: { fileSize: MAX_FILE_SIZE } }).single('video');

  upload(req, res, async (err) => {
    if (err) return res.status(400).json({ error: 'Erreur upload' });
    if (!req.file) return res.status(400).json({ error: 'Aucun fichier' });

    try {
      const metadata = await validateVideo(req.file.path);
      console.log(`✅ Upload validé: ${req.file.filename} (${metadata.duration}s, ${metadata.resolution})`);
      res.json({ message: 'Upload OK', filename: req.file.filename, metadata });
    } catch (validationErr) {
      fs.unlinkSync(req.file.path);
      res.status(400).json(validationErr);
    }
  });
});

// Merge endpoint (seulement pour la session)
app.post('/merge', async (req, res) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== API_KEY) return res.status(401).json({ error: 'Clé API invalide' });

  const sessionId = req.body.sessionId || req.query.sessionId;
  if (!sessionId) return res.status(400).json({ error: 'sessionId requis' });

  const videoFiles = fs.readdirSync(videosDir).filter(f => f.startsWith(`video_${sessionId}_`)).sort();
  if (videoFiles.length < 2) return res.status(400).json({ error: 'Besoin de 2+ vidéos pour cette session' });

  try {
    const metadatas = await Promise.all(videoFiles.map(f => validateVideo(path.join(videosDir, f))));
    if (metadatas.some(m => !m.isValid)) throw new Error('Vidéos invalides');

    const totalDuration = metadatas.reduce((sum, m) => sum + m.duration, 0);

    const timestamp = Date.now();
    const filelistPath = path.join(videosDir, `filelist_${sessionId}_${timestamp}.txt`);
    const outputPath = path.join(videosDir, `output_${sessionId}_${timestamp}.mp4`);
    let inputFiles = []; // Fichiers à concat (originaux ou normalisés)

    // Normalisation conditionnelle
    for (let i = 0; i < videoFiles.length; i++) {
      const inputPath = path.join(videosDir, videoFiles[i]);
      const metadata = metadatas[i];

      if (!needsNormalization(metadata)) {
        inputFiles.push(inputPath);
      } else {
        const normPath = path.join(videosDir, `norm_${sessionId}_${i}_${timestamp}.mp4`);
        const normCmd = `${ffmpegPath} -i "${inputPath}" -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2" -r 30 -c:v libx264 -preset veryfast -crf 23 -c:a aac -b:a 128k "${normPath}"`;

        await new Promise((res, rej) => {
          exec(normCmd, { timeout: 300000 }, (err, _, stderr) => {
            if (err) rej(new Error(parseFFmpegError(stderr)));
            else res();
          });
        });

        inputFiles.push(normPath);
      }
    }

    // Créer filelist
    fs.writeFileSync(filelistPath, inputFiles.map(f => `file '${f}'`).join('\n'));

    // Fonction pour exécuter FFmpeg avec progression
    const runFFmpegWithProgress = (args, socketId) => {
      return new Promise((resolve, reject) => {
        const ffmpeg = spawn(ffmpegPath, args);
        let stderrData = '';

        ffmpeg.stderr.on('data', (data) => {
          stderrData += data.toString();
          const progress = parseFFmpegProgress(stderrData);
          
          if (progress && socketId) {
            io.to(socketId).emit('merge-progress', {
              ...progress,
              stage: 'fusion',
              message: `Fusion en cours... ${progress.progress}% (${progress.eta} restant)`
            });
          }
        });

        ffmpeg.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(parseFFmpegError(stderrData)));
          }
        });

        ffmpeg.on('error', (err) => {
          reject(new Error(err.message));
        });
      });
    };

    // Concat avec -c copy d'abord
    const socketId = req.body.socketId;
    if (socketId) {
      io.to(socketId).emit('merge-progress', {
        progress: 0,
        stage: 'preparation',
        message: 'Préparation de la fusion...'
      });
    }

    try {
      const concatArgs = [
        '-f', 'concat',
        '-safe', '0',
        '-i', filelistPath,
        '-c', 'copy',
        '-fflags', '+genpts',
        '-avoid_negative_ts', 'make_zero',
        outputPath
      ];

      await runFFmpegWithProgress(concatArgs, socketId);
    } catch (error) {
      // Fallback à re-encode si copy échoue
      if (socketId) {
        io.to(socketId).emit('merge-progress', {
          progress: 0,
          stage: 'fallback',
          message: 'Tentative avec re-encodage...'
        });
      }

      const reencodeArgs = [
        '-f', 'concat',
        '-safe', '0',
        '-i', filelistPath,
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-crf', '23',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-fflags', '+genpts',
        '-avoid_negative_ts', 'make_zero',
        outputPath
      ];

      await runFFmpegWithProgress(reencodeArgs, socketId);
    }

    if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) throw new Error('Output invalide');

    // Vérifier durée output
    const durationCmd = `${ffprobePath} -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${outputPath}"`;
    const actualDuration = await new Promise(res => {
      exec(durationCmd, (_, stdout) => res(parseFloat(stdout.trim())));
    });

    if (Math.abs(actualDuration - totalDuration) > 5) console.warn('⚠️ Durée mismatch');

    // Nettoyage session (supprime inputs et temp, garde output)
    cleanupSession(sessionId);
    
    // Nettoyage supplémentaire : supprimer aussi les anciens outputs de cette session
    const sessionOutputs = fs.readdirSync(videosDir).filter(f => f.startsWith(`output_${sessionId}_`) && f !== path.basename(outputPath));
    sessionOutputs.forEach(file => {
      const filePath = path.join(videosDir, file);
      try {
        fs.unlinkSync(filePath);
        console.log(`🗑️ Ancien output supprimé: ${file}`);
      } catch (err) {
        console.warn(`⚠️ Erreur suppression ancien output ${file}:`, err.message);
      }
    });

    res.json({
      message: 'Fusion OK',
      output: `/videos/${path.basename(outputPath)}`,
      duration: actualDuration,
      size: fs.statSync(outputPath).size
    });
  } catch (err) {
    cleanupSession(sessionId); // Nettoie même en erreur
    res.status(500).json({ error: err.message });
  }
});

// Cleanup endpoint
app.delete('/cleanup', (req, res) => {
  if (req.headers['x-api-key'] !== API_KEY) return res.status(401).json({ error: 'Clé API invalide' });
  cleanupOldFiles();
  res.json({ message: 'Nettoyage OK' });
});

// Health
app.get('/health', (_, res) => res.json({ status: 'OK' }));

// Gestion d'erreurs globale
process.on('uncaughtException', (err) => {
  console.error('❌ Erreur non gérée:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Promise rejetée non gérée:', reason);
});

// Gestion gracieuse de l'arrêt
process.on('SIGTERM', () => {
  console.log('🛑 Signal SIGTERM reçu, arrêt gracieux...');
  server.close(() => {
    console.log('✅ Serveur arrêté proprement');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 Signal SIGINT reçu, arrêt gracieux...');
  server.close(() => {
    console.log('✅ Serveur arrêté proprement');
    process.exit(0);
  });
});

// Pour tests : si lancé avec 'test'
if (process.argv[2] === 'test') {
  // Intègre ici le code de quick-test.js si tu veux tester auto
  console.log('Lancement test...');
  // Ajoute le contenu de quick-test.js ici si besoin
  const runQuickTest = () => {
    // Colle le code de quick-test.js ici pour l'exécuter
    // Par exemple:
    console.log('Test en cours...');
    // ... (tout le code de quick-test.js)
  };
  runQuickTest();
} else {
  // Socket.IO connection handling
  io.on('connection', (socket) => {
    console.log(`🔌 Client connecté: ${socket.id}`);
    
    socket.on('disconnect', () => {
      console.log(`🔌 Client déconnecté: ${socket.id}`);
    });
  });

  // Démarrage du serveur avec gestion d'erreurs
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Serveur sur port ${PORT}`);
    console.log(`📁 Dossier vidéos: ${videosDir}`);
    console.log(`🔧 FFmpeg: ${ffmpegPath}`);
    console.log(`🔌 Socket.IO activé`);
    console.log(`🌍 Mode: ${process.env.NODE_ENV || 'development'}`);
  });
}