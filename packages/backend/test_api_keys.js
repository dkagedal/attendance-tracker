const admin = require('firebase-admin');
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';

admin.initializeApp({ projectId: 'demo-project' });
const db = admin.firestore();

async function runTest() {
  const uid = 'testuser123';
  const token = `at_${uid}_12345abcdef`;
  
  await db.collection('users').doc(uid).collection('apikeys').doc(token).set({
    name: 'Test Script',
    createdAt: admin.firestore.Timestamp.now(),
    readonly: true
  });
  
  await db.collection('bands').doc('testband').collection('members').doc(uid).set({
    display_name: 'Test User'
  });
  
  console.log('Test setup complete. Token:', token);
  
  const fetch = require('node-fetch');
  const res = await fetch('http://127.0.0.1:5001/demo-project/us-central1/api/bands/testband/events', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  console.log('Status:', res.status);
  console.log('Body:', await res.text());
  
  process.exit(0);
}

runTest().catch(console.error);
