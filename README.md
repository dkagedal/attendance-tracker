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

## Rollup

Install rollup

```
$ npm install -g rollup
```

To rebuild:

```
$ rollup -c
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
$ firebase serve
```

To upload:

```
$ firebase deploy
```

## Database schema

* Collection *bands*
    * Document id=short string
        * Field *display_name*: Human-readable name of the band
        * Field *acl*: Array of uid of users that can see the band
    * Collection *events*
        * Document id=random
            * Field *type*: The type of event, a string from a small number of common types
            * Field *location*: Venum name or address (string)
            * Field *description*: (optional) Description of the event.
            * Field *start*: Timestamp when the event starts
            * Field *stop*: (optional) timestamp when the event ends
        * Collection *participants*
            * Document id=user id
                * Field *attending*: yes/no/maybe/replacement
    * Collection *users*
        * Document id=user id
            * Field *admin*: boolean true if user can manage band config
            * Field *display_name*: Name to use for the user in context of this band
* Collection *admins*: The site admins
    * Document id=uid
        * _No fields_