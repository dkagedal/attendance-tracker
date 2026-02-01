import { initializeApp } from "firebase/app";
import { FirebaseConfig } from "./config";
import { initDB } from "./storage";
import "./components/app-drawer";
import "./components/app-dialog";
import { AppMain } from "./components/app-main";
import "./components/app-main";

const app = initializeApp(FirebaseConfig());
console.log("Initialized app");
initDB(app, location.hostname === "localhost");

for (const element of document.getElementsByTagName("app-main")) {
  const appMain = element as AppMain;
  appMain.app = app;
  appMain.requestUpdate();
}

console.log("Loaded");
