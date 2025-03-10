# Development environment

## Nix

The instructions here assume you will be using Nix to set up the environment, using the included `shell.nix` file.

Read more at https://nixos.org/ or just install it with

```
$ curl -L https://nixos.org/nix/install | sh -s -- --daemon
```

## Clone Git repository

```
$ git clone whatever:attendance-tracker
$ cd attendance-tracker
```

## Enter the Nix environment

```
$ nix-shell
```

If you want to install dependencies yourself, check the `shell.nix` file for details.

## Install npm modules

```
$ npm ci
```

Note that in Nix, you typically don't use the `-g` flag too `npm install`.

## Set up Firebase

Login to Firebase (if not already logged in):

```
$ firebase login
```

Make sure you have a Firebase project to work with, created in the Firebase console.

Set the current project to work with, and pick an alias for it:

```
$ firebase use --add
```

## Build functions

```
$ cd functions
$ npm ci
$ npm run build
$ cd ..
```

TODO: make this part of top-level build.

## Run locally

For testing:

```
$ npm run serve
```

To upload:

```
$ firebase deploy
```

See https://firebase.google.com/docs/hosting/deploying tolearn more about how to deploy the app.

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
            * Document id=uid
                * Field *attending*: yes/no/sub/na
                * Field *comment*: a string
    * Collection *users*
        * Document id=uid
            * Field *admin*: boolean true if user can manage band config
            * Field *display_name*: Name to use for the user in context of this band
* Collection *admins*: The site admins
    * Document id=uid
        * _No fields_
