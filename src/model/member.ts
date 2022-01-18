import { CollectionReference, doc, DocumentReference, setDoc, SetOptions } from "firebase/firestore";
import { UID } from "../datamodel";
import { MemberSettingsReference } from "./membersettings";

export class MemberReference {
  dbref: DocumentReference<Member>;
  constructor(ref: DocumentReference<any>) {
    this.dbref = ref.withConverter(MemberConverter);
  }
  get id(): string {
    return this.dbref.id;
  }

  update(data: any, options: SetOptions= {}): Promise<void> {
    return setDoc(this.dbref, data, options);
  }

  settings(): MemberSettingsReference {
    return new MemberSettingsReference(doc(this.dbref, "private", "settings"));
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
