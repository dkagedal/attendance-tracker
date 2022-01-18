import {
  doc,
  DocumentReference,
  Firestore,
  FirestoreDataConverter
} from "firebase/firestore";
import { ParticipantResponse } from "./model/participant";

export const responseLabels: Map<ParticipantResponse, string> = new Map([
  ["yes", "Kommer"],
  ["no", "Kommer inte"],
  ["sub", "Skickar ersättare"],
  ["na", "Inget svar"]
]);

export function responseString(response: ParticipantResponse) {
  return responseLabels.get(response);
}

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

// Global user data, stored in /users/{uid}. This is not used for much other than as a way
// to provide a list of bands to switch to in the UI.
export class User {
  constructor(
    public readonly uid: UID,
    public readonly bands: { [id: string]: { display_name: string } }
  ) {}

  static converter: FirestoreDataConverter<User> = {
    toFirestore: (user: User) => {
      return {
        bands: user.bands
      };
    },
    fromFirestore: (snapshot, options) => {
      const data = snapshot.data(options);
      return new User(snapshot.id, data.bands);
    }
  };

  static ref(db: Firestore, uid: string): DocumentReference<User> {
    return doc(db, "users", uid).withConverter(User.converter);
  }
}
