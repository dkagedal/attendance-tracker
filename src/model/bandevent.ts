import { collection, doc, DocumentReference, Firestore, getDoc, query, Query, QueryConstraint } from "firebase/firestore";

export interface BandEventRef {
  bandid: string;
  eventid: string;
  dbref: DocumentReference;
  read: () => Promise<BandEvent>;
}

export interface BandEvent {
  ref: BandEventRef;
  type: string;
  start: string;
  stop?: string;
  location?: string;
  description?: string;
  cancelled?: boolean;
  year: () => string;
  hasStopTime: () => boolean;
}

export function BandEventQuery(bandRef: DocumentReference, ...constraints: QueryConstraint[]):Query<BandEvent> {
  return query(collection(bandRef, "events"), ...constraints).withConverter(BandEventConverter);
}

class BandEventRefImpl implements BandEventRef {
  constructor(private ref: DocumentReference<BandEvent>) { }

  static ref(db: Firestore, bandid: string, eventid: string) {
    return new BandEventRefImpl(doc(db, "bands", bandid, "events", eventid).withConverter(BandEventConverter))
  }

  get bandid() { return this.ref.parent.id; }
  get eventid() { return this.ref.id };
  get dbref() {    return this.ref;}

  read() {
    return getDoc(this.ref).then(snapshot => snapshot.data());
  }
}

class BandEventConverter {
  static toFirestore(event: BandEvent): object {
    const data: any = {
      type: event.type,
      start: event.start
    };
    if (event.stop) {
      data.stop = event.stop;
    }
    if (event.location) {
      data.location = event.location;
    }
    if (event.description) {
      data.description = event.description;
    }
    if (event.cancelled) {
      data.cancelled = event.cancelled;
    }
    return data;
  }

  static fromFirestore(snapshot: any, options: any): BandEvent {
    const data = snapshot.data(options);
    return new BandEventFromDb(
      new BandEventRefImpl(snapshot.ref),
      data.type,
      data.start,
      data.stop,
      data.location,
      data.description,
      data.cancelled
    );
  }
}

// A band event.
class BandEventFromDb implements BandEvent {
  constructor(
    public ref: BandEventRef,
    public type: string,
    public start: string,
    public stop?: string,
    public location?: string,
    public description?: string,
    public cancelled?: boolean
  ) { }

  get id() {
    return this.ref.eventid;
  }

  year(): string {
    return this.start.split("-", 1)[0];
  }

  hasStopTime(): boolean {
    return !!this.stop;
  }
}
