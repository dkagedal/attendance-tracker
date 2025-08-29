import {
  addDoc,
  CollectionReference,
  DocumentReference,
  FirestoreError,
  onSnapshot,
  Query,
  query,
  QuerySnapshot,
  setDoc,
  SetOptions
} from "firebase/firestore";

export class JoinRequestReference {
  dbref: DocumentReference<JoinRequest>;
  constructor(ref: DocumentReference<any>) {
    this.dbref = ref.withConverter(JoinRequestConverter);
  }
  get id(): string {
    return this.dbref.id;
  }

  update(data: any, options?: SetOptions): Promise<void> {
    return setDoc(this.dbref.withConverter(null), data, options);
  }
}

export class JoinRequestCollectionReference {
  dbref: CollectionReference<JoinRequest>;
  constructor(ref: CollectionReference<any>) {
    this.dbref = ref.withConverter(JoinRequestConverter);
  }

  async add(joinRequest: JoinRequest): Promise<JoinRequestReference> {
    const ref = await addDoc(this.dbref, joinRequest);
    return new JoinRequestReference(ref);
  }

  query() {
    return new JoinRequestQuery(query(this.dbref));
  }
}

class JoinRequestQuery {
  constructor(public query: Query<JoinRequest>) {}

  onSnapshot(
    onNext: (joinRequest: QuerySnapshot<JoinRequest>) => void,
    onError?: (error: FirestoreError) => void
  ) {
    return onSnapshot(this.query, onNext, onError);
  }
}

export interface JoinRequest {
  ref?: JoinRequestReference;
  display_name: string;
  url: string;
  approved: boolean;
}

class JoinRequestConverter {
  static toFirestore(joinRequest: JoinRequest) {
    return {
      display_name: joinRequest.display_name,
      url: joinRequest.url,
      approved: joinRequest.approved
    };
  }

  static fromFirestore(snapshot, options): JoinRequest {
    const data = snapshot.data(options);
    return {
      ref: new JoinRequestReference(snapshot.ref),
      display_name: data.display_name,
      url: data.url,
      approved: data.approved
    };
  }
}
