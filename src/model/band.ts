import {
  collection,
  doc,
  DocumentReference,
  Firestore
} from "firebase/firestore";
import { BandEventCollectionReference, BandEventReference } from "./bandevent";
import { MemberCollectionReference, MemberReference } from "./member";

export class BandReference {
  dbref: DocumentReference<Band>;
  constructor(ref: DocumentReference<any>) {
    this.dbref = ref.withConverter(BandConverter);
  }
  get id() {
    return this.dbref.id;
  }

  events(): BandEventCollectionReference {
    return new BandEventCollectionReference(collection(this.dbref, "events"));
  }

  event(eventid: string) {
    return new BandEventReference(doc(this.dbref, "events", eventid));
  }

  members(): MemberCollectionReference {
    return new MemberCollectionReference(collection(this.dbref, "members"));
  }

  member(memberid: string) {
    return new MemberReference(doc(this.dbref, "members", memberid));
  }
}

export function band(db: Firestore, bandid: string): BandReference {
  return new BandReference(doc(db, "bands", bandid));
}

// Not needed:
// export function bands(db: Firestore) { return new BandQuery(db, "bands")); }

class BandConverter {
  static toFirestore(band: Band) {
    return {
      display_name: band.display_name
    };
  }

  static fromFirestore(snapshot, options): Band {
    const data = snapshot.data(options);
    return new Band(new BandReference(snapshot.ref), data.display_name);
  }
}

export class Band {
  constructor(public ref: BandReference, public display_name: string) {}
}
