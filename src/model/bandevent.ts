import {
    doc,
    DocumentReference,
    Firestore,
} from "firebase/firestore";


// A band event.
export class BandEvent {
    constructor(
        public ref: DocumentReference<BandEvent>,
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
        return new BandEvent(
            snapshot.ref,
            data.type,
            data.start,
            data.stop,
            data.location,
            data.description,
            data.cancelled
        );
    }

    static makeref(
        db: Firestore,
        bandid: string,
        eventid: string
    ): DocumentReference<BandEvent> {
        return doc(db, "bands", bandid, "events", eventid).withConverter(BandEvent);
    }

    year(): string {
        return this.start.split("-", 1)[0];
    }

    hasStopTime(): boolean {
        return !!this.stop;
    }
}
