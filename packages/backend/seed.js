const admin = require('firebase-admin');

process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';
process.env.GCLOUD_PROJECT = 'demo-project';

admin.initializeApp({
    projectId: 'demo-project',
});

const db = admin.firestore();

async function seed() {
    const bandId = 'beatles';
    const bandRef = db.collection('bands').doc(bandId);

    console.log(`Seeding band: ${bandId}...`);

    // Create band
    await bandRef.set({
        name: 'The Beatles',
    });

    // Create members
    const members = [
        { id: 'john', display_name: 'John Lennon', admin: true },
        { id: 'paul', display_name: 'Paul McCartney', admin: true },
        { id: 'george', display_name: 'George Harrison', admin: false },
        { id: 'ringo', display_name: 'Ringo Starr', admin: false },
    ];

    console.log('Seeding members...');
    for (const m of members) {
        await bandRef.collection('members').doc(m.id).set({
            display_name: m.display_name,
            admin: m.admin,
        });
    }

    // Create events
    const now = new Date();

    const addDays = (date, days) => {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    };

    const formatDate = (date, timeStr) => {
        // Format: YYYY-MM-DDTHH:mm:ss
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}T${timeStr}`;
    };

    const events = [
        {
            type: 'Rehearsal',
            start: formatDate(addDays(now, 2), '19:00:00'),
            stop: formatDate(addDays(now, 2), '21:00:00'),
            location: 'Abbey Road',
            description: 'Preparing for the winter tour',
        },
        {
            type: 'Rehearsal',
            start: formatDate(addDays(now, 9), '19:00:00'),
            stop: formatDate(addDays(now, 9), '21:00:00'),
            location: 'Abbey Road',
            description: 'New songs',
        },
        {
            type: 'Gig',
            start: formatDate(addDays(now, 14), '20:00:00'),
            stop: formatDate(addDays(now, 14), '23:00:00'),
            location: 'The Cavern Club',
            description: 'Homecoming show',
        },
        {
            type: 'Recording',
            start: formatDate(addDays(now, 20), '10:00:00'),
            stop: formatDate(addDays(now, 20), '18:00:00'),
            location: 'Studio 2',
            description: 'Recording session',
        },
        {
            type: 'Christmas Party',
            start: formatDate(addDays(now, 30), '18:00:00'),
            stop: formatDate(addDays(now, 31), '02:00:00'),
            location: 'Apple Corps HQ',
            description: 'Annual party',
        }
    ];

    console.log('Seeding events...');

    // Clear existing events first
    const existingEvents = await bandRef.collection('events').get();
    if (!existingEvents.empty) {
        console.log('Clearing existing events...');
        const batch = db.batch();
        existingEvents.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
    }

    for (const e of events) {
        await bandRef.collection('events').add(e);
    }

    console.log('Seeding complete!');
}

seed().catch(console.error);
