import firebase from "firebase/app";  // HIDE

export interface UserBand {
    display_name: string,
}

export interface User {
    display_name: string,
    bands: {
        [id: string]: UserBand,
    },
}

export interface Member {
    display_name: string,
}

export interface BandEvent {
    type: string,
    start?: string,
    stop?: string,
    location?: string,
    description?: string,
    cancelled?: boolean,
}

export type ParticipantResponse = "yes" | "no" | "maybe" | "sub" | null

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

export type UID = string

export const db = firebase.firestore();
if (location.hostname === "localhost") {
    db.settings({
        host: "localhost:8080",
        ssl: false
    });
}

export async function ensureUserExists(user: firebase.User): Promise<firebase.firestore.DocumentReference<User>> {
    const docRef = db.doc(`users/${user.uid}`) as firebase.firestore.DocumentReference<User>;
    const snapshot = await docRef.get();
    if (!snapshot.exists) {
        const data = {
            display_name: user.displayName || "??",
            bands: {}
        };
        console.log("Creating user record for", user.displayName);
        await docRef.set(data, { merge: true });
    }
    return docRef;
}

async function getUser(uid: UID): Promise<User> {
    const docRef = db.doc(`users/${uid}`);
    const snapshot = await docRef.get();
    if (snapshot.exists) {
        console.log("Found user", snapshot.data());
        return snapshot.data() as User;
    }
    return null;
}

export interface MemberSettings {
    display_name: string,
    email?: string,
    reminders?: any,
    calendar?: boolean,
}

const memberSettingsDefaults: MemberSettings = {
    display_name: "",
    email: "",
    reminders: {},
    calendar: false,
}
export async function getMemberSettings(memberRef: firebase.firestore.DocumentReference): Promise<MemberSettings> {
    const settingsRef = memberRef.collection('settings').doc('general');
    const snapshot = await settingsRef.get();
    if (!snapshot.exists) {
        const user = await getUser(memberRef.id as UID);
        const settings = Object.assign({ display_name: user.display_name }, memberSettingsDefaults) as MemberSettings;
        // Don't wait for settings to be set
        settingsRef.set(settings).catch(reason => console.log("Failed to set settings:", reason));
        return settings;
    }
    return Object.assign({}, memberSettingsDefaults, snapshot.data()) as MemberSettings;
}