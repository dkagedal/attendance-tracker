let
  nixpkgs = fetchTarball "https://github.com/NixOS/nixpkgs/tarball/nixos-24.11";
  pkgs = import nixpkgs { config = {}; overlays = []; };
in

pkgs.mkShellNoCC {
  packages = with pkgs; [
    # source control tools:
    git
    jujutsu

    # Build tools:
    nodejs_20
    #typescript
    #nodePackages.rollup

    # Firebase:
    firebase-tools
    jdk17
    #zulu23
  ];
}
