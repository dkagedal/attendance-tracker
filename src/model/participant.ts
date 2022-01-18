import {  CollectionReference, DocumentReference } from "firebase/firestore";
import { UID } from "../datamodel";

export class ParticipantReference {
  dbref: DocumentReference<Participant>
  constructor(ref: DocumentReference<any>) {
    this.dbref = ref.withConverter(ParticipantConverter)
  }
  get id(): string { return this.dbref.id; }
}

export class ParticipantCollectionReference {
  dbref: CollectionReference<Participant>;
  constructor(ref: CollectionReference<any>) {
    this.dbref = ref.withConverter(ParticipantConverter)
  }
}

export type ParticipantResponse = "yes" | "no" | "sub" | "na";

export interface Participant {
  ref: ParticipantReference;
  uid: UID;
  attending: ParticipantResponse;
  comment: string;
  hasResponded: () => boolean;
}

export function emptyParticipant(uid: UID): Participant {
  return {
    ref: null, uid, attending: "na", comment: "",
    hasResponded: () => false
  };
}

class ParticipantConverter {
  static toFirestore(participant: Participant): object {
    return {
      attending: participant.attending,
      comment: participant.comment
    };
  }

  static fromFirestore(snapshot: any, options: any): Participant {
    const data = snapshot.data(options);
    if (["yes", "no", "sub", "na"].indexOf(data.attending) == -1) {
      data.attending = "na";
    }
    return new ParticipantFromDb(
      new ParticipantReference(snapshot.ref),
      data.attending || "na",
      data.comment || ""
    );
  }
}

// A band event.
class ParticipantFromDb implements Participant {
  constructor(
    public ref: ParticipantReference,
    public attending: ParticipantResponse,
    public comment: string
  ) { }

  get uid() {
    return this.ref.id;
  }

  hasResponded(): boolean {
    switch (this.attending) {
      case "yes":
      case "no":
      case "sub":
        return true;
      default:
        return false;
    }
  }
}
