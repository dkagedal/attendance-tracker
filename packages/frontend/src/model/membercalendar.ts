import {
  deleteDoc,
  DocumentReference,
  onSnapshot,
  setDoc,
  Timestamp,
  Unsubscribe,
} from "firebase/firestore";

export interface MemberCalendar {
  secret: string;
  createdAt: Timestamp;
}

class MemberCalendarConverter {
  static toFirestore(calendar: MemberCalendar) {
    return {
      secret: calendar.secret,
      createdAt: calendar.createdAt,
    };
  }

  static fromFirestore(snapshot: any, options: any): MemberCalendar {
    const data = snapshot.data(options);
    return {
      secret: typeof data.secret === "string" ? data.secret : "",
      createdAt: data.createdAt,
    };
  }
}

export class MemberCalendarReference {
  dbref: DocumentReference<MemberCalendar>;

  constructor(ref: DocumentReference<any>) {
    this.dbref = ref.withConverter(MemberCalendarConverter);
  }

  subscribe(
    onNext: (calendar: MemberCalendar | null) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    return onSnapshot(
      this.dbref,
      (snapshot) => {
        onNext(snapshot.exists() ? snapshot.data() : null);
      },
      onError
    );
  }

  save(secret: string): Promise<void> {
    return setDoc(this.dbref, {
      secret,
      createdAt: Timestamp.now(),
    });
  }

  delete(): Promise<void> {
    return deleteDoc(this.dbref);
  }
}
