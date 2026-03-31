const admin = require('firebase-admin');

process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';
process.env.GCLOUD_PROJECT = 'demo-project';

admin.initializeApp({
    projectId: 'demo-project',
});

const db = admin.firestore();

async function seed() {
    const bandId = 'test';
    const bandRef = db.collection('bands').doc(bandId);

    console.log(`Seeding band: ${bandId}...`);

    // Create band
    await bandRef.set({
        display_name: 'Duke Ellington Orchestra',
        sections: [
            { id: 'trumpets', name: 'Trumpets', emoji: '🎺' },
            { id: 'trombones', name: 'Trombones', emoji: '🎷' },
            { id: 'reeds', name: 'Reeds', emoji: '🎷' },
            { id: 'rhythm', name: 'Rhythm', emoji: '🥁' },
            { id: 'vocals', name: 'Vocals', emoji: '🎤' },
        ],
    });

    // Create members
    const members = [
        { id: 'duke', display_name: 'Duke', admin: true, section_id: 'rhythm' },
        { id: 'nance', display_name: 'Ray Nance', admin: false, section_id: 'trumpets' },
        { id: 'stewart', display_name: 'Rex Stewart', admin: false, section_id: 'trumpets' },
        { id: 'jones', display_name: 'Wallace Jones', admin: false, section_id: 'trumpets' },
        { id: 'brown', display_name: 'Lawrence Brown', admin: false, section_id: 'trombones' },
        { id: 'nanton', display_name: 'Tricky Sam', admin: false, section_id: 'trombones' },
        { id: 'tizol', display_name: 'Juan Tizol', admin: false, section_id: 'trombones' },
        { id: 'hodges', display_name: 'Johnny Hodges', admin: false, section_id: 'reeds' },
        { id: 'hardwick', display_name: 'Otto Hardwick', admin: false, section_id: 'reeds' },
        { id: 'webster', display_name: 'Ben Webster', admin: false, section_id: 'reeds' },
        { id: 'bigard', display_name: 'Barney Bigard', admin: false, section_id: 'reeds' },
        { id: 'carney', display_name: 'Harry Carney', admin: false, section_id: 'reeds' },
        { id: 'blanton', display_name: 'Jimmy Blanton', admin: false, section_id: 'rhythm' },
        { id: 'raglin', display_name: 'Junior', admin: false, section_id: 'rhythm' },
        { id: 'guy', display_name: 'Fred Guy', admin: false, section_id: 'rhythm' },
        { id: 'greer', display_name: 'Sonny Greer', admin: false, section_id: 'rhythm' },
        { id: 'anderson', display_name: 'Ivie Anderson', admin: false, section_id: 'vocals' },
        { id: 'jeffries', display_name: 'Herb Jeffries', admin: false, section_id: 'vocals' },
    ];

    console.log('Seeding members and users...');
    for (const m of members) {
        await bandRef.collection('members').doc(m.id).set({
            display_name: m.display_name,
            admin: m.admin,
            section_id: m.section_id,
        });

        // Populate users collection to ensure initial lookup succeeds
        await db.collection('users').doc(m.id).set({
            bands: {
                [bandId]: {
                    display_name: 'Duke Ellington Orchestra'
                }
            }
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
            location: 'The Cotton Club',
            description: 'Preparing for the winter tour',
        },
        {
            type: 'Rehearsal',
            start: formatDate(addDays(now, 9), '19:00:00'),
            stop: formatDate(addDays(now, 9), '21:00:00'),
            location: 'The Cotton Club',
            description: 'New arrangements',
        },
        {
            type: 'Gig',
            start: formatDate(addDays(now, 14), '20:00:00'),
            stop: formatDate(addDays(now, 14), '23:00:00'),
            location: 'Carnegie Hall',
            description: 'Historical performance',
        },
        {
            type: 'Recording',
            start: formatDate(addDays(now, 20), '10:00:00'),
            stop: formatDate(addDays(now, 20), '18:00:00'),
            location: 'Columbia Records Studio',
            description: 'Recording session for the new hits',
        },
        {
            type: 'Christmas Party',
            start: formatDate(addDays(now, 30), '18:00:00'),
            stop: formatDate(addDays(now, 31), '02:00:00'),
            location: 'Hotel Sherman',
            description: 'Annual party for members and friends',
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
