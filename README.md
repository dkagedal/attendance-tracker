# Development environment

## Clone Git repository

```
$ git clone whatever:attendance-tracker
$ cd attendance-tracker
```

## Install npm

Google it.

## Install LitElement from the Polymer project

```
$ npm install lit-element
```

See https://lit-element.polymer-project.org/ for more information.

## Polymer CLI

There are apparently many tools that can do the things we need, but I
have only tried the polymer CLI, and the polymer configuration file is
included in the Git repository.

```
$ npm install -g polymer-cli
```

To rebuild:

```
$ polymer build
```

## Install firebase and set it up

See https://firebase.google.com/docs/web/setup.

And https://firebase.google.com/docs/cli for how to install the
firebase command-line tools. Using the npm install method, like this:

```
$ npm install -g firebase-tools
```

Firebase services used:

* **Firebase Hosting** to serve files
* **Cloud Firestore** as storage
* **Authentication** for, well, authentication
* And maybe more?

In particular, see https://firebase.google.com/docs/hosting/deploying
learn about how to deploy the app.

For testing:

```
$ firebase serve --only functions
```

To upload:

```
$ firebase deploy
```
