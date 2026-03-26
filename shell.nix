{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  nativeBuildInputs = with pkgs; [
    pkg-config
  ];

  buildInputs = with pkgs; [
    gtk4
    libadwaita
    webkitgtk_6_0
    libsoup_3
    dbus
  ];
}
