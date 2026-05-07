import * as express from 'express';
import * as cors from 'cors';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { BandEvent } from './types';

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

const getDb = () => getFirestore();

// Middleware to authenticate via Firebase Auth or Custom API Tokens
const requireAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: Missing or invalid Authorization header' });
    return;
  }

  const token = authHeader.split('Bearer ')[1].trim();

  let uid: string;
  let isReadOnly = false;

  try {
    if (token.startsWith('at_')) {
      // Custom API token format: at_{UID}_{RANDOM}
      const parts = token.split('_');
      if (parts.length >= 3) {
        uid = parts[1];
        // Verify token in Firestore
        const apiKeyDoc = await getDb().collection('users').doc(uid).collection('apikeys').doc(token).get();
        if (!apiKeyDoc.exists) {
          res.status(401).json({ error: 'Unauthorized: Invalid custom API token' });
          return;
        }
        
        const keyData = apiKeyDoc.data();
        if (keyData?.readonly) {
          isReadOnly = true;
        }
      } else {
        res.status(401).json({ error: 'Unauthorized: Invalid custom API token format' });
        return;
      }
    } else {
      // Standard Firebase Auth ID token
      const decodedToken = await getAuth().verifyIdToken(token);
      uid = decodedToken.uid;
    }
    
    // If the key is readonly, block non-GET requests
    if (isReadOnly && req.method !== 'GET') {
      res.status(403).json({ error: 'Forbidden: This API key is read-only' });
      return;
    }
    
    // Add uid to request for potential use in routes
    (req as any).uid = uid;

    next();
  } catch (error) {
    console.error('Error during authentication:', error);
    res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

const requireBandMember = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const bandId = (req.params as any).bandId;
  const uid = (req as any).uid;

  try {
    // Check if user is a member of the band to mirror frontend rules
    const memberDoc = await getDb().collection('bands').doc(bandId).collection('members').doc(uid).get();
    if (!memberDoc.exists) {
      res.status(403).json({ error: 'Forbidden: User is not a member of this band' });
      return;
    }

    next();
  } catch (error) {
    console.error('Error during authorization:', error);
    res.status(500).json({ error: 'Failed to verify band membership' });
  }
};

const bandRouter = express.Router({ mergeParams: true });
bandRouter.use(requireAuth);
bandRouter.use(requireBandMember);

// Get user's bands
app.get('/users/me/bands', requireAuth, async (req, res) => {
  try {
    const uid = (req as any).uid;
    const userDoc = await getDb().collection('users').doc(uid).get();
    if (!userDoc.exists) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    const userData = userDoc.data();
    res.json(userData?.bands || {});
  } catch (error) {
    console.error('Error fetching user bands:', error);
    res.status(500).json({ error: 'Failed to fetch user bands' });
  }
});

// Get all events for a band
bandRouter.get('/events', async (req, res) => {
  try {
    const eventsSnapshot = await getDb().collection('bands').doc((req.params as any).bandId).collection('events').get();
    const events: Record<string, BandEvent> = {};
    eventsSnapshot.forEach((doc) => {
      events[doc.id] = doc.data() as BandEvent;
    });
    res.json(events);
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// Get a single event
bandRouter.get('/events/:eventId', async (req, res) => {
  try {
    const doc = await getDb().collection('bands').doc((req.params as any).bandId).collection('events').doc((req.params as any).eventId).get();
    if (!doc.exists) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }
    res.json({ id: doc.id, ...doc.data() });
  } catch (error) {
    console.error('Error fetching event:', error);
    res.status(500).json({ error: 'Failed to fetch event' });
  }
});

// Create a new event
bandRouter.post('/events', async (req, res) => {
  try {
    const eventData = req.body as BandEvent;
    // Basic validation
    if (!eventData.type || !eventData.start) {
      res.status(400).json({ error: 'Missing required fields: type and start' });
      return;
    }

    const docRef = await getDb().collection('bands').doc((req.params as any).bandId).collection('events').add(eventData);
    res.status(201).json({ id: docRef.id, ...eventData });
  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

// Update an event
bandRouter.put('/events/:eventId', async (req, res) => {
  try {
    const eventData = req.body;
    const docRef = getDb().collection('bands').doc((req.params as any).bandId).collection('events').doc((req.params as any).eventId);
    
    // We can use { merge: true } or just update. For REST PUT, it's typically a full replace,
    // but update is safer to not delete subcollections. Let's use set with merge.
    await docRef.set(eventData, { merge: true });
    
    const updatedDoc = await docRef.get();
    res.json({ id: updatedDoc.id, ...updatedDoc.data() });
  } catch (error) {
    console.error('Error updating event:', error);
    res.status(500).json({ error: 'Failed to update event' });
  }
});

// Delete an event
bandRouter.delete('/events/:eventId', async (req, res) => {
  try {
    await getDb().collection('bands').doc((req.params as any).bandId).collection('events').doc((req.params as any).eventId).delete();
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting event:', error);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

app.use('/bands/:bandId', bandRouter);

export { app as expressApp };
