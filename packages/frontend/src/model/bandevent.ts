import {
  addDoc,
  collection,
  CollectionReference,
  doc,
  DocumentReference,
  FirestoreDataConverter,
  setDoc,
  SetOptions
} from "firebase/firestore";
import { UID } from "../datamodel";
import {
  ParticipantCollectionReference,
  ParticipantReference
} from "./participant";

export class BandEventReference {
  dbref: DocumentReference<BandEvent>;
  constructor(ref: DocumentReference<any>) {
    this.dbref = ref.withConverter(BandEventConverter);
  }

  get id(): string {
    return this.dbref.id;
  }

  update(data: any, options?: SetOptions): Promise<void> {
    return setDoc(this.dbref, data, options);
  }

  participants(): ParticipantCollectionReference {
    return new ParticipantCollectionReference(
      collection(this.dbref, "participants")
    );
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

  async add(event: BandEvent): Promise<BandEventReference> {
    const ref = await addDoc(this.dbref, event);
    return new BandEventReference(ref);
  }
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
  clone: () => BandEvent;
}

const BandEventConverter: FirestoreDataConverter<BandEvent> = {
  toFirestore(event: BandEvent): object {
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
    if (event.cancelled !== undefined) {
      data.cancelled = !!event.cancelled;
    } else {
      data.cancelled = false;
    }
    return data;
  },

  fromFirestore(snapshot: any, options: any): BandEvent {
    const data = snapshot.data(options);
    return new BandEventFromDb(
      new BandEventReference(snapshot.ref),
      data.type,
      data.start,
      data.stop,
      data.location,
      data.description,
      !!data.cancelled
    );
  }
};

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

  clone(): BandEvent {
    return new BandEventFromDb(
      this.ref,
      this.type,
      this.start,
      this.stop,
      this.location,
      this.description,
      this.cancelled
    );
  }
}
