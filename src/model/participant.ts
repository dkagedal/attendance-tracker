import { collection, doc, DocumentReference, Firestore, getDoc, query, Query, QueryConstraint } from "firebase/firestore";
import { UID } from "../datamodel";
import { BandEventRef } from "./bandevent";

export interface ParticipantRef {
  bandid: string;
  eventid: string;
  uid: UID;

  read: (db: Firestore) => Promise<Participant>;
}

export function participantRef(db: Firestore, bandid: string, eventid:string) {
  return new ParticipantRefImpl(doc(db, "bands", bandid, "events", eventid).withConverter(ParticipantConverter))
}

export type ParticipantResponse = "yes" | "no" | "sub" | "na";

export interface Participant {
  ref: ParticipantRef;
  uid: UID;
  response: ParticipantResponse;
  comment: string;
  hasResponded: () => boolean;
}

export function ParticipantQuery(eventRef: BandEventRef, ...constraints: QueryConstraint[]): Query<Participant> {
  return query(collection(eventRef.dbref, "events"), ...constraints).withConverter(ParticipantConverter);
}

export function emptyParticipant(uid: UID): Participant {
  return {
    ref: null, uid, response: "na", comment: "",
    hasResponded: () => false
  };
}

class ParticipantRefImpl implements ParticipantRef {
  constructor(private ref: DocumentReference<Participant>) { }

  get bandid() { return this.ref.parent.parent.id; }
  get eventid() { return this.ref.parent.id; }
  get uid() { return this.ref.id };

  read() {
    return getDoc(this.ref).then(snapshot => snapshot.data());
  }
}

class ParticipantConverter {
  static toFirestore(participant: Participant): object {
    return {
      attending: participant.response,
      comment: participant.comment
    };
  }

  static fromFirestore(snapshot: any, options: any): Participant {
    const data = snapshot.data(options);
    if (["yes", "no", "sub", "na"].indexOf(data.attending) == -1) {
      data.attending = "na";
    }
    return new ParticipantFromDb(
      new ParticipantRefImpl(snapshot.ref),
      data.attending || "na",
      data.comment || ""
    );
  }
}

// A band event.
class ParticipantFromDb implements Participant {
  constructor(
    public ref: ParticipantRef,
    public response: ParticipantResponse,
    public comment: string
  ) { }

  get uid() {
    return this.ref.uid;
  }

  hasResponded(): boolean {
    switch (this.response) {
      case "yes":
      case "no":
      case "sub":
        return true;
      default:
        return false;
    }
  }
}
