const fs = require('fs');
const path = require('path');

// Test simple de l'API locale
async function testLocalAPI() {
  console.log('🧪 Test de l\'API locale...');
  
  // Test health
  try {
    const healthRes = await fetch('http://localhost:3000/health');
    const healthData = await healthRes.json();
    console.log('✅ Health OK:', healthData);
  } catch (err) {
    console.error('❌ Health failed:', err.message);
    return;
  }
  
  // Test upload (simulé)
  console.log('📤 Test upload simulé...');
  
  // Test merge (simulé)
  console.log('🎬 Test merge simulé...');
  
  console.log('✅ Tests terminés');
}

testLocalAPI(); 