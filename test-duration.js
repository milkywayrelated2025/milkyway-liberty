const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const videosDir = path.join(__dirname, 'videos');
const ffmpegPath = '/usr/local/bin/ffmpeg';

// Fonction pour obtenir la durée d'une vidéo
function getVideoDuration(filePath) {
  return new Promise((resolve, reject) => {
    const command = `"${ffmpegPath.replace('ffmpeg', 'ffprobe')}" -v error -select_streams v:0 -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`;
    
    exec(command, (error, stdout) => {
      if (error) {
        reject(error);
        return;
      }
      
      const duration = parseFloat(stdout.trim());
      resolve(duration);
    });
  });
}

// Fonction pour tester la fusion
async function testFusion() {
  console.log('🧪 Test de fusion avec vérification de durée...');
  
  try {
    // Lister les fichiers vidéo disponibles
    const videoFiles = fs.readdirSync(videosDir)
      .filter(file => /^video_\d+\.mp4$/i.test(file))
      .sort();
    
    if (videoFiles.length < 2) {
      console.log('❌ Pas assez de vidéos pour tester (minimum 2)');
      return;
    }
    
    console.log(`📁 Vidéos trouvées: ${videoFiles.length}`);
    
    // Calculer la durée totale attendue
    let totalExpectedDuration = 0;
    for (const file of videoFiles) {
      const duration = await getVideoDuration(path.join(videosDir, file));
      totalExpectedDuration += duration;
      console.log(`📊 ${file}: ${duration.toFixed(1)}s`);
    }
    
    console.log(`📊 Durée totale attendue: ${totalExpectedDuration.toFixed(1)}s`);
    
    // Chercher le fichier de sortie le plus récent
    const outputFiles = fs.readdirSync(videosDir)
      .filter(file => /^output_\d+\.mp4$/i.test(file))
      .sort()
      .reverse();
    
    if (outputFiles.length === 0) {
      console.log('❌ Aucun fichier de sortie trouvé');
      return;
    }
    
    const latestOutput = outputFiles[0];
    const outputPath = path.join(videosDir, latestOutput);
    
    console.log(`🔍 Analyse du fichier de sortie: ${latestOutput}`);
    
    // Vérifier la durée réelle
    const actualDuration = await getVideoDuration(outputPath);
    const outputSize = fs.statSync(outputPath).size;
    
    console.log(`📊 Durée réelle: ${actualDuration.toFixed(1)}s`);
    console.log(`📊 Taille: ${(outputSize / 1024 / 1024).toFixed(1)} MB`);
    
    // Vérifier si la durée est correcte (tolérance de ±2 secondes)
    const durationDiff = Math.abs(actualDuration - totalExpectedDuration);
    const isCorrect = durationDiff <= 2;
    
    if (isCorrect) {
      console.log('✅ SUCCÈS: La durée est correcte !');
      console.log(`📈 Différence: ${durationDiff.toFixed(1)}s (tolérance: ±2s)`);
    } else {
      console.log('❌ ÉCHEC: La durée est incorrecte !');
      console.log(`📉 Différence: ${durationDiff.toFixed(1)}s (tolérance: ±2s)`);
      console.log(`⚠️  Durée attendue: ${totalExpectedDuration.toFixed(1)}s`);
      console.log(`⚠️  Durée réelle: ${actualDuration.toFixed(1)}s`);
    }
    
    // Vérifier si la durée n'est pas excessive (> 24h = 86400s)
    if (actualDuration > 86400) {
      console.log('🚨 ALERTE: Durée excessive détectée (> 24h)');
      console.log('🔧 Cela indique un problème avec les flags FFmpeg');
    }
    
    return {
      expected: totalExpectedDuration,
      actual: actualDuration,
      difference: durationDiff,
      isCorrect,
      size: outputSize
    };
    
  } catch (error) {
    console.error('❌ Erreur lors du test:', error.message);
  }
}

// Exécuter le test
testFusion().then(result => {
  if (result) {
    console.log('\n📋 Résumé du test:');
    console.log(`   Durée attendue: ${result.expected.toFixed(1)}s`);
    console.log(`   Durée réelle: ${result.actual.toFixed(1)}s`);
    console.log(`   Différence: ${result.difference.toFixed(1)}s`);
    console.log(`   Statut: ${result.isCorrect ? '✅ CORRECT' : '❌ INCORRECT'}`);
    console.log(`   Taille: ${(result.size / 1024 / 1024).toFixed(1)} MB`);
  }
  process.exit(0);
}).catch(error => {
  console.error('❌ Erreur fatale:', error.message);
  process.exit(1);
});