#![cfg_attr(target_os = "windows", windows_subsystem = "windows")]

use rust_embed::RustEmbed;

#[derive(RustEmbed)]
#[folder = "dist/"]
struct Assets;

const ICON_BYTES: &[u8] = include_bytes!("assets/favicon.png");

fn main() {
    trayserve::run(trayserve::App::<Assets> {
        name: "ShortRest".into(),
        id: "shortrest".into(),
        port: 7777,
        icon_png: ICON_BYTES,
        headless: None,
        _assets: std::marker::PhantomData,
    });
}
