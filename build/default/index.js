import "./bandlist.js";
firebase.auth().onAuthStateChanged(function (user) {
  if (user) {
    // User is signed in.
    document.getElementById("firebaseui-auth-container").style.display = 'none';
    document.getElementById("bands").style.display = 'block';
    document.getElementById("username").innerText = user.displayName + ' - ' + user.email;
  } else {
    // No user is signed in.
    document.getElementById("bands").style.display = 'none';
    document.getElementById("firebaseui-auth-container").style.display = 'block';
    document.getElementById("username").innerText = "inte inloggad";
  }
}); // Initialize the FirebaseUI Widget using Firebase.

var ui = new firebaseui.auth.AuthUI(firebase.auth());
ui.start('#firebaseui-auth-container', {
  signInOptions: [firebase.auth.EmailAuthProvider.PROVIDER_ID, firebase.auth.GoogleAuthProvider.PROVIDER_ID] // Other config options...

});