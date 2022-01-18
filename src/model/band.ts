import { collection, doc, DocumentReference, Firestore, getDoc, query, Query, QueryConstraint } from "firebase/firestore";

export class BandRef {
  dbref: DocumentReference<Band>;
  get id() { return dbref.id; }

  events(...constraints: QueryConstraints[]): BandEventQuery {
    return collection(this.dbref, "events").withConverter(BandEventConverter);
  }
   
  event(eventid: string) {
    return doc(this.dbref, "events", eventid).withConverter(BandEventConverter);
  }

  members(...constraints: QueryConstraints[]): BandMemberQuery {
    return collection(this.dbref, "members").withConverter(MemberConverter);
  }
   
  member(memberid: string) {
    return doc(this.dbref, "members", memberid).withConverter(MemberConverter);
  }
}

export function band(db: Firestore, bandid: string) {
  return new BandRef(doc(dh, "bands", bandid));
}

// Not needed:
// export function bands(db: Firestore) { return new BandQuery(db, "bands")); }

