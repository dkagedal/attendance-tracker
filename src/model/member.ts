import { CollectionReference, DocumentReference } from "firebase/firestore";
import { UID } from "../datamodel";

export class MemberReference {
  dbref: DocumentReference<Member>;
  constructor(ref: DocumentReference<any>) {
    this.dbref = ref.withConverter(MemberConverter);
  }
  get id(): string {
    return this.dbref.id;
  }
}

export class MemberCollectionReference {
  dbref: CollectionReference<Member>;
  constructor(ref: CollectionReference<any>) {
    this.dbref = ref.withConverter(MemberConverter);
  }
}

export interface Member {
  ref: MemberReference;
  id: UID;
  display_name: string;
  admin: boolean;
}

class MemberConverter {
  static toFirestore(member: Member) {
    return {
      display_name: member.display_name,
      admin: member.admin
    };
  }

  static fromFirestore(snapshot, options): Member {
    const data = snapshot.data(options);
    return new MemberFromDb(
      new MemberReference(snapshot.ref),
      data.display_name,
      data.admin
    );
  }
}

// A band event.
class MemberFromDb implements Member {
  constructor(
    public ref: MemberReference,
    public display_name: string,
    public admin: boolean
  ) {}

  get id(): UID {
    return this.ref.id;
  }
}
