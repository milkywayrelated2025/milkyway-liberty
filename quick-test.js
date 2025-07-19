const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const videosDir = path.join(__dirname, 'videos');
const ffmpegPath = '/usr/local/bin/ffmpeg';

// Créer des vidéos de test simples
async function createTestVideos() {
  console.log('🎬 Création de vidéos de test...');
  
  const testVideos = [
    { name: 'test1.mp4', duration: 5, content: 'Test vidéo 1 - 5 secondes' },
    { name: 'test2.mp4', duration: 3, content: 'Test vidéo 2 - 3 secondes' }
  ];
  
  for (const video of testVideos) {
    const outputPath = path.join(videosDir, `video_${Date.now()}.mp4`);
    
    // Créer une vidéo simple avec FFmpeg
    const command = `"${ffmpegPath}" -f lavfi -i "testsrc=duration=${video.duration}:size=320x240:rate=1" -f lavfi -i "sine=frequency=1000:duration=${video.duration}" -c:v libx264 -c:a aac -shortest "${outputPath}"`;
    
    console.log(`📹 Création: ${video.content}`);
    
    await new Promise((resolve, reject) => {
      exec(command, (error) => {
        if (error) {
          console.error(`❌ Erreur création ${video.name}:`, error.message);
          reject(error);
        } else {
          console.log(`✅ ${video.name} créé (${video.duration}s)`);
          resolve();
        }
      });
    });
    
    // Attendre un peu entre chaque création
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

// Simuler la fusion
async function simulateMerge() {
  console.log('\n🔄 Simulation de la fusion...');
  
  // Lister les vidéos
  const videoFiles = fs.readdirSync(videosDir)
    .filter(file => /^video_\d+\.mp4$/i.test(file))
    .sort();
  
  if (videoFiles.length < 2) {
    console.log('❌ Pas assez de vidéos pour tester');
    return;
  }
  
  console.log(`📁 Vidéos à fusionner: ${videoFiles.length}`);
  
  // Créer la liste de fichiers
  const timestamp = Date.now();
  const filelistPath = path.join(videosDir, `filelist_${timestamp}.txt`);
  const outputPath = path.join(videosDir, `output_${timestamp}.mp4`);
  
  const filelistContent = videoFiles
    .map(file => `file '${path.join(videosDir, file)}'`)
    .join('\n');
  
  fs.writeFileSync(filelistPath, filelistContent);
  console.log(`📝 Liste créée: ${filelistPath}`);
  
  // Commande FFmpeg avec les flags de correction
  const ffmpegCommand = `"${ffmpegPath}" -f concat -safe 0 -i "${filelistPath}" -fflags +genpts -avoid_negative_ts make_zero -c:v libx264 -preset veryfast -crf 23 -c:a aac -b:a 128k "${outputPath}"`;
  
  console.log('🔄 Exécution de la fusion...');
  console.log(`📝 Commande: ${ffmpegCommand}`);
  
  return new Promise((resolve, reject) => {
    exec(ffmpegCommand, { timeout: 60000 }, (error, stdout, stderr) => {
      // Nettoyer la liste
      try { fs.unlinkSync(filelistPath); } catch (e) {}
      
      if (error) {
        console.error('❌ Erreur fusion:', error.message);
        if (stderr) console.error('Stderr:', stderr);
        reject(error);
        return;
      }
      
      if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
        console.error('❌ Fichier de sortie invalide');
        reject(new Error('Fichier de sortie invalide'));
        return;
      }
      
      const outputSize = fs.statSync(outputPath).size;
      console.log(`✅ Fusion réussie: ${path.basename(outputPath)} (${(outputSize / 1024 / 1024).toFixed(1)} MB)`);
      
      resolve(outputPath);
    });
  });
}

// Vérifier la durée
async function checkDuration(outputPath) {
  console.log('\n🔍 Vérification de la durée...');
  
  const command = `"${ffmpegPath.replace('ffmpeg', 'ffprobe')}" -v error -select_streams v:0 -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${outputPath}"`;
  
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout) => {
      if (error) {
        reject(error);
        return;
      }
      
      const duration = parseFloat(stdout.trim());
      console.log(`📊 Durée de la vidéo fusionnée: ${duration.toFixed(1)}s`);
      
      // Vérifier si la durée est raisonnable (5+3=8s ±2s)
      const expectedDuration = 8;
      const durationDiff = Math.abs(duration - expectedDuration);
      
      if (durationDiff <= 2) {
        console.log('✅ SUCCÈS: Durée correcte !');
        console.log(`📈 Différence: ${durationDiff.toFixed(1)}s`);
      } else if (duration > 86400) {
        console.log('🚨 ALERTE: Durée excessive (> 24h) - Problème avec les flags FFmpeg !');
        console.log(`📉 Durée détectée: ${duration.toFixed(1)}s (${(duration/3600).toFixed(1)}h)`);
      } else {
        console.log('❌ ÉCHEC: Durée incorrecte');
        console.log(`📉 Différence: ${durationDiff.toFixed(1)}s`);
      }
      
      resolve(duration);
    });
  });
}

// Test complet
async function runQuickTest() {
  try {
    console.log('🚀 Test rapide de la correction FFmpeg...\n');
    
    // Nettoyer les anciens fichiers
    if (fs.existsSync(videosDir)) {
      const files = fs.readdirSync(videosDir);
      files.forEach(file => {
        try { fs.unlinkSync(path.join(videosDir, file)); } catch (e) {}
      });
    }
    
    // Créer les vidéos de test
    await createTestVideos();
    
    // Simuler la fusion
    const outputPath = await simulateMerge();
    
    // Vérifier la durée
    await checkDuration(outputPath);
    
    console.log('\n✅ Test terminé !');
    
  } catch (error) {
    console.error('❌ Erreur lors du test:', error.message);
  }
}

// Exécuter le test
runQuickTest();