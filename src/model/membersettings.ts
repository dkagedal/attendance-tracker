import {
  DocumentReference,
  getDoc,
  setDoc,
  SetOptions
} from "firebase/firestore";

export class MemberSettingsReference {
  dbref: DocumentReference<MemberSettings>;
  constructor(ref: DocumentReference<any>) {
    this.dbref = ref.withConverter(MemberSettingsConverter);
  }

  async read(): Promise<MemberSettings | null> {
    const doc = await getDoc(this.dbref);
    return doc.exists() ? doc.data() : null;
  }

  async update(data: any, options: SetOptions = {}): Promise<void> {
    setDoc(this.dbref, data, options);
  }
}

// Private settings for a band member, stored in /bands/{bandid}/members/{uid}/private/settings, readable by the member and an admin.
export class MemberSettings {
  constructor(
    public email: string,
    public notify: {
      new_event: boolean;
      new_join_request: boolean;
      new_member: boolean;
    }
  ) {}

  static DEFAULT = new MemberSettings("", {
    new_event: true,
    new_join_request: true,
    new_member: true
  });
}

class MemberSettingsConverter {
  static toFirestore(settings: MemberSettings): object {
    return {
      email: settings.email,
      notify: settings.notify
    };
  }

  static fromFirestore(snapshot: any, options: any): MemberSettings {
    return snapshot.data(options) as MemberSettings;
  }
}
