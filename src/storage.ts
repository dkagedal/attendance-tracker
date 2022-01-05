import { FirebaseApp, FirebaseError } from "firebase/app";
import {
  getFirestore,
  connectFirestoreEmulator,
  doc,
  getDoc,
  setDoc,
  DocumentReference,
  Firestore,
  collection,
  onSnapshot,
  QuerySnapshot,
  FirestoreError
} from "firebase/firestore";
import {
  Auth,
  connectAuthEmulator,
  getAuth,
  onAuthStateChanged,
  User as FirebaseUser
} from "firebase/auth";

export interface UserBand {
  display_name: string;
}

// TODO: https://firebase.google.com/docs/firestore/query-data/get-data?authuser=0#custom_objects
export interface User {
  uid: string;
  display_name: string;
  bands: {
    [id: string]: UserBand;
  };
}

export const userConverter = {
  toFirestore: (user: User) => {
    return {
      display_name: user.display_name,
      bands: user.bands
    };
  },
  fromFirestore: (snapshot, options) => {
    const data = snapshot.data(options);
    return {
      uid: snapshot.id,
      display_name: data.display_name,
      bands: data.bands
    } as User;
  }
};

export interface Member {
  display_name: string;
  admin: boolean;
}

export const memberConverter = {
  toFirestore: (member: Member) => {
    return member;
  },
  fromFirestore: (snapshot, options) => {
    return snapshot.data(options) as Member;
  }
};

export interface BandEvent {
  type: string;
  start: string;
  stop?: string;
  location?: string;
  description?: string;
  cancelled?: boolean;
}

export function bandEventYear(event: BandEvent): string {
  return event.start.split("-", 1)[0];
}

export type ParticipantResponse = "yes" | "no" | "maybe" | "sub" | null;

export function hasResponded(response: ParticipantResponse): boolean {
  switch (response) {
    case "yes":
    case "no":
    case "sub":
      return true;
    default:
      return false;
  }
}

export type UID = string;

export var db: Firestore;
export var auth: Auth;

var loginStateCallback = null;
export function onLoginStateChanged(
  callback: (authUser: FirebaseUser) => Promise<void>
) {
  loginStateCallback = callback;
}

export function initDB(app: FirebaseApp, useEmulator: boolean) {
  console.log("Initializing database and stuff");
  db = getFirestore(app);
  if (useEmulator) {
    console.log("Connecting to Firestore emulator");
    connectFirestoreEmulator(db, "localhost", 8080);
  }

  auth = getAuth();
  auth.languageCode = "sv";
  if (useEmulator) {
    console.log("Connecting to Auth emulator");
    connectAuthEmulator(auth, "http://localhost:9099");
  }
  if (loginStateCallback) {
    onAuthStateChanged(auth, loginStateCallback);
  }
}

function userRef(uid: string): DocumentReference<User> {
  return doc(db, "users", uid).withConverter(userConverter);
}

export async function ensureUserExists(
  user: FirebaseUser
): Promise<DocumentReference<User>> {
  const docRef = userRef(user.uid);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) {
    const data: User = {
      uid: user.uid,
      display_name: user.displayName || "??",
      bands: {}
    };
    console.log("Creating user record for", user.displayName);
    await setDoc(docRef, data, { merge: true });
  }
  return docRef;
}

async function getUser(uid: UID): Promise<User> {
  const docRef = userRef(uid);
  const snapshot = await getDoc(docRef);
  if (snapshot.exists) {
    console.log("Found user", snapshot.data());
    return snapshot.data();
  }
  return null;
}

export interface MemberSettings {
  display_name: string;
  email?: string;
  reminders?: any;
  calendar?: boolean;
}

const memberSettingsDefaults: MemberSettings = {
  display_name: "",
  email: "",
  reminders: {},
  calendar: false
};
export async function getMemberSettings(
  memberRef: DocumentReference
): Promise<MemberSettings> {
  const settingsRef = doc(memberRef, "settings", "general");
  const snapshot = await getDoc(settingsRef);
  if (!snapshot.exists) {
    const user = await getUser(memberRef.id as UID);
    const settings = Object.assign(
      { display_name: user.display_name },
      memberSettingsDefaults
    ) as MemberSettings;
    // Don't wait for settings to be set
    setDoc(settingsRef, settings).catch(reason =>
      console.log("Failed to set settings:", reason)
    );
    return settings;
  }
  return Object.assign(
    {},
    memberSettingsDefaults,
    snapshot.data()
  ) as MemberSettings;
}

export async function getHostBand(
  hostname: string | null
): Promise<string | null> {
  const docRef = doc(db, "hosts", hostname);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) {
    return null;
  }
  return snapshot.data()!.band;
}

export interface JoinRequest {
  display_name: string;
  url: string;
  approved: boolean;
}

export const joinRequestConverter = {
  toFirestore: (joinRequest: JoinRequest) => {
    return joinRequest;
  },
  fromFirestore: (snapshot, options) => {
    return snapshot.data(options) as JoinRequest;
  }
};

export class JoinRequestError extends Error {
  readonly name = "JoinRequestError";

  constructor(
    readonly code: string,
    message: string,
    public firebaseError?: FirebaseError
  ) {
    super(firebaseError ? message + ": " + firebaseError.toString() : message);
  }
}

export async function CreateJoinRequest(
  bandid: string,
  user: FirebaseUser
): Promise<void> {
  if (!bandid) {
    throw new JoinRequestError("join/create", "No bandid given");
  }
  const docRef = doc(db, "bands", bandid, "join_requests", user.uid);
  const joinRequest: JoinRequest = {
    display_name: user.displayName || "Utan Namn",
    url: location.href,
    approved: false
  };
  console.log("Making a join request to", docRef);
  try {
    return await setDoc(docRef, joinRequest, { merge: true });
  } catch (reason) {
    throw new JoinRequestError(
      "join/create",
      `Failed to create join request ${docRef.path}`,
      reason
    );
  }
}

export function onJoinRequestSnapshot(
  bandid: string,
  onNext: (snapshot: QuerySnapshot<JoinRequest>) => void,
  onError?: (error: FirestoreError) => void
) {
  const ref = collection(db, "bands", bandid, "join_requests").withConverter(joinRequestConverter);
  return onSnapshot(ref, onNext, onError);
}
