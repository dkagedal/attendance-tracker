import { collection, CollectionReference, doc, DocumentReference } from "firebase/firestore";
import { UID } from "../datamodel";
import { ParticipantCollectionReference, ParticipantReference } from "./participant";

export class BandEventReference {
  dbref: DocumentReference<BandEvent>;
  constructor(ref: DocumentReference<any>) {
    this.dbref = ref.withConverter(BandEventConverter);
  }

  get id(): string { return this.dbref.id };

  participants(): ParticipantCollectionReference {
    return new ParticipantCollectionReference(collection(this.dbref, "participants"));
  }

  participant(uid: UID): ParticipantReference {
    return new ParticipantReference(doc(this.dbref, "participants", uid));
  }
}

export class BandEventCollectionReference {
  dbref: CollectionReference<BandEvent>;
  constructor(ref: CollectionReference<any>) {
    this.dbref = ref.withConverter(BandEventConverter);
  }
  get id(): string { return this.dbref.id;}
}

export interface BandEvent {
  ref: BandEventReference;
  type: string;
  start: string;
  stop?: string;
  location?: string;
  description?: string;
  cancelled?: boolean;
  year: () => string;
  hasStopTime: () => boolean;
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
      new BandEventReference(snapshot.ref),
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
    public ref: BandEventReference,
    public type: string,
    public start: string,
    public stop?: string,
    public location?: string,
    public description?: string,
    public cancelled?: boolean
  ) { }

  get id() {
    return this.ref.id;
  }

  year(): string {
    return this.start.split("-", 1)[0];
  }

  hasStopTime(): boolean {
    return !!this.stop;
  }
}
