import {
  doc,
  DocumentReference,
  Firestore,
  FirestoreDataConverter
} from "firebase/firestore";

// Global user data, stored in /users/{uid}. This is not used for much other than as a way
// to provide a list of bands to switch to in the UI.
export class User {
  constructor(
    public readonly uid: string,
    public readonly bands: { [id: string]: { display_name: string } }
  ) {}

  static converter: FirestoreDataConverter<User> = {
    toFirestore: (user: User) => {
      return {
        bands: user.bands
      };
    },
    fromFirestore: (snapshot, options) => {
      const data = snapshot.data(options);
      return new User(snapshot.id, data.bands);
    }
  };

  static ref(db: Firestore, uid: string): DocumentReference<User> {
    return doc(db, "users", uid).withConverter(User.converter);
  }
}

// Non-private band member data, stored in /bands/{bandid}/members/{uid}, visible to all band members.
export class Member {
  constructor(
    public readonly display_name: string,
    public readonly admin: boolean
  ) {}

  static converter = {
    toFirestore: (member: Member) => {
      return member;
    },
    fromFirestore: (snapshot, options) => {
      return snapshot.data(options) as Member;
    }
  };

  static ref(
    db: Firestore,
    bandid: string,
    uid: string
  ): DocumentReference<Member> {
    return doc(db, "bands", bandid, "members", uid).withConverter(
      Member.converter
    );
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

  static converter = {
    toFirestore: (settings: MemberSettings): object => {
      return {
        email: settings.email,
        notify: settings.notify
      };
    },
    fromFirestore: (snapshot: any, options: any): MemberSettings => {
      return snapshot.data(options) as MemberSettings;
    }
  };

  static ref(
    db: Firestore,
    bandid: string,
    uid: string
  ): DocumentReference<MemberSettings> {
    return doc(
      db,
      "bands",
      bandid,
      "members",
      uid,
      "private",
      "settings"
    ).withConverter(MemberSettings.converter);
  }
}
