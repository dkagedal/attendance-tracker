import { FirebaseApp, FirebaseError } from "firebase/app";
import {
  getFirestore,
  connectFirestoreEmulator,
  doc,
  getDoc,
  Firestore
} from "firebase/firestore";
import {
  Auth,
  connectAuthEmulator,
  getAuth,
  onAuthStateChanged,
  User as FirebaseUser
} from "firebase/auth";
import { JoinRequest } from "./model/joinrequest";
import { band } from "./model/band";

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

export interface MemberSettings {
  display_name: string;
  email?: string;
  reminders?: any;
  calendar?: boolean;
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
  const docRef = band(db, bandid).join_request(user.uid);
  const joinRequest: JoinRequest = {
    display_name: user.displayName || "Utan Namn",
    url: location.href,
    approved: false
  };
  console.log("Making a join request to", docRef);
  try {
    return await docRef.update(joinRequest);
  } catch (reason) {
    throw new JoinRequestError(
      "join/create",
      `Failed to create join request ${docRef.dbref.path}`,
      reason
    );
  }
}
