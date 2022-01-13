import {
  doc,
  DocumentReference,
  Firestore,
  FirestoreDataConverter
} from "firebase/firestore";

export type ParticipantResponse = "yes" | "no" | "sub" | "na";
export const responseLabels: Map<ParticipantResponse, string> = new Map([
  ["yes", "Kommer"],
  ["no", "Kommer inte"],
  ["sub", "Skickar ersättare"],
  ["na", "Inget svar"]
]);

export function responseString(response: ParticipantResponse) {
  return responseLabels.get(response);
}

export function hasResponded(response: ParticipantResponse): boolean {
  switch (response) {
    case "yes":
    case "no":
    case "sub":
      return true;
    default:
      return false;
  }
}

export type UID = string;

// Global user data, stored in /users/{uid}. This is not used for much other than as a way
// to provide a list of bands to switch to in the UI.
export class User {
  constructor(
    public readonly uid: UID,
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
    public readonly uid: UID,
    public readonly display_name: string,
    public readonly admin: boolean
  ) {}

  static converter = {
    toFirestore: (member: Member) => {
      return {
        display_name: member.display_name,
        admin: member.admin
      };
    },
    fromFirestore: (snapshot, options) => {
      const data = snapshot.data(options);
      return new Member(snapshot.id, data.display_name, data.admin);
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

// A participation record.
export class Participant {
  constructor(
    public uid: UID,
    public response: ParticipantResponse,
    public comment: string
  ) {}

  static empty(uid: UID) {
    return new Participant(uid, "na", "");
  }

  static toFirestore(participant: Participant): object {
    return {
      attending: participant.response,
      comment: participant.comment
    };
  }

  static fromFirestore(snapshot: any, options: any): Participant {
    const data = snapshot.data(options);
    if (["yes", "no", "sub", "na"].indexOf(data.attending) == -1) {
      data.attending = "na";
    }
    return new Participant(
      snapshot.id,
      data.attending || "na",
      data.comment || ""
    );
  }

  static ref(
    db: Firestore,
    bandid: string,
    eventid: string,
    uid: UID
  ): DocumentReference<Participant> {
    return doc(
      db,
      "bands",
      bandid,
      "events",
      eventid,
      "participants",
      uid
    ).withConverter(Participant);
  }

  hasResponded(): boolean {
    switch (this.response) {
      case "yes":
      case "no":
      case "sub":
        return true;
      default:
        return false;
    }
  }
}
