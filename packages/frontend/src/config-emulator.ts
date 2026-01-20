import { FirebaseOptions } from "firebase/app";

export function FirebaseConfig(): FirebaseOptions {
  return {
    //  "Demo" config for running with emulators
    apiKey: "your-api-key",
    authDomain: "your-project-id.firebaseapp.com",
    projectId: "demo-project",
    storageBucket: "your-project-id.appspot.com",
    messagingSenderId: "your-sender-id",
    appId: "your-app-id",
  };
}