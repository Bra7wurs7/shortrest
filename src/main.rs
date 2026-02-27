#![cfg_attr(target_os = "windows", windows_subsystem = "windows")]

use axum::{
    Router,
    body::Body,
    http::{StatusCode, Uri, header},
    response::{IntoResponse, Response},
};
use rust_embed::RustEmbed;
use std::net::SocketAddr;

#[cfg(not(target_os = "linux"))]
use muda::{Menu, MenuEvent, MenuItem, PredefinedMenuItem};
#[cfg(not(target_os = "linux"))]
use tray_icon::{Icon, TrayIconBuilder};

#[derive(RustEmbed)]
#[folder = "dist/"]
struct Assets;

const ICON_BYTES: &[u8] = include_bytes!("assets/favicon.png");

#[cfg(not(target_os = "linux"))]
fn load_icon() -> Icon {
    let img = image::load_from_memory(ICON_BYTES)
        .expect("Failed to load embedded icon")
        .into_rgba8();
    let (width, height) = img.dimensions();
    let rgba = img.into_raw();
    Icon::from_rgba(rgba, width, height).expect("Failed to create icon")
}

// Linux tray via D-Bus StatusNotifierItem (ksni).
// No GTK/GDK/Pango/Cairo required — only libdbus-1 as a system dependency.
#[cfg(target_os = "linux")]
struct ShortRestTray {
    server_url: String,
    icon: ksni::Icon,
}

#[cfg(target_os = "linux")]
impl ksni::Tray for ShortRestTray {
    fn id(&self) -> String {
        "shortrest".into()
    }

    fn title(&self) -> String {
        "ShortRest".into()
    }

    fn tool_tip(&self) -> ksni::ToolTip {
        ksni::ToolTip {
            title: "ShortRest Server".into(),
            ..Default::default()
        }
    }

    fn activate(&mut self, _x: i32, _y: i32) {
        let _ = webbrowser::open(&self.server_url);
    }

    fn icon_pixmap(&self) -> Vec<ksni::Icon> {
        vec![self.icon.clone()]
    }

    fn menu(&self) -> Vec<ksni::MenuItem<Self>> {
        use ksni::menu::*;
        vec![
            StandardItem {
                label: "Open in Browser".into(),
                activate: Box::new(|this: &mut Self| {
                    let _ = webbrowser::open(&this.server_url);
                }),
                ..Default::default()
            }
            .into(),
            ksni::MenuItem::Separator,
            StandardItem {
                label: "Quit".into(),
                activate: Box::new(|_| std::process::exit(0)),
                ..Default::default()
            }
            .into(),
        ]
    }
}

fn main() {
    let addr = SocketAddr::from(([127, 0, 0, 1], 7777));
    let server_url = format!("http://{}", addr);

    // Start the async server in a background thread
    let server_url_clone = server_url.clone();
    std::thread::spawn(move || {
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async {
            match tokio::net::TcpListener::bind(&addr).await {
                Ok(listener) => {
                    println!("Server started successfully!");
                    println!("   Listening on http://{}", addr);
                    println!("   Look for the tray icon to quit or open in browser.");

                    let app = Router::new().fallback(static_handler);

                    if let Err(e) = webbrowser::open(&server_url_clone) {
                        eprintln!("Failed to open web browser: {}", e);
                        eprintln!("   Please navigate to {} manually.", server_url_clone);
                    }

                    axum::serve(listener, app).await.unwrap();
                }
                Err(e) => {
                    if e.to_string().contains("Address already in use") {
                        println!("Port 7777 is already in use!");
                        if let Err(browser_err) = webbrowser::open(&server_url_clone) {
                            eprintln!("Failed to open web browser: {}", browser_err);
                            eprintln!("   Please navigate to {} manually.", server_url_clone);
                        }
                    } else {
                        eprintln!("Server failed to start: {:?}", e);
                    }
                    std::process::exit(0);
                }
            }
        });
    });

    #[cfg(target_os = "linux")]
    {
        // Convert RGBA to ARGB32 (SNI spec / ksni uses ARGB network byte order)
        let img = image::load_from_memory(ICON_BYTES)
            .expect("Failed to load embedded icon")
            .into_rgba8();
        let (width, height) = img.dimensions();
        let argb: Vec<u8> = img
            .into_raw()
            .chunks(4)
            .flat_map(|p| [p[3], p[0], p[1], p[2]])
            .collect();

        let tray = ShortRestTray {
            server_url: server_url.clone(),
            icon: ksni::Icon {
                width: width as i32,
                height: height as i32,
                data: argb,
            },
        };

        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async {
            use ksni::TrayMethods as _;
            let _handle: ksni::Handle<ShortRestTray> =
                tray.spawn().await.expect("Failed to spawn tray service");
            std::future::pending::<()>().await
        });
    }

    #[cfg(not(target_os = "linux"))]
    {
        // Create menu items
        let menu = Menu::new();
        let open_item = MenuItem::new("Open in Browser", true, None);
        let quit_item = MenuItem::new("Quit", true, None);

        menu.append(&open_item).unwrap();
        menu.append(&PredefinedMenuItem::separator()).unwrap();
        menu.append(&quit_item).unwrap();

        let open_id = open_item.id().clone();
        let quit_id = quit_item.id().clone();

        // Create the tray icon on the main thread
        let _tray_icon = TrayIconBuilder::new()
            .with_menu(Box::new(menu))
            .with_tooltip("ShortRest Server")
            .with_icon(load_icon())
            .build()
            .expect("Failed to create tray icon");

        #[cfg(target_os = "windows")]
        {
            use windows_sys::Win32::UI::WindowsAndMessaging::{
                DispatchMessageW, GetMessageW, MSG, TranslateMessage,
            };

            let menu_receiver = MenuEvent::receiver();
            let mut msg: MSG = unsafe { std::mem::zeroed() };
            loop {
                while unsafe { GetMessageW(&mut msg, std::ptr::null_mut(), 0, 0) } > 0 {
                    unsafe {
                        TranslateMessage(&msg);
                        DispatchMessageW(&msg);
                    }

                    if let Ok(event) = menu_receiver.try_recv() {
                        if event.id == open_id {
                            let _ = webbrowser::open(&server_url);
                        } else if event.id == quit_id {
                            std::process::exit(0);
                        }
                    }
                }
            }
        }

        #[cfg(target_os = "macos")]
        {
            use std::time::Duration;
            let menu_receiver = MenuEvent::receiver();
            loop {
                if let Ok(event) = menu_receiver.recv_timeout(Duration::from_millis(100)) {
                    if event.id == open_id {
                        let _ = webbrowser::open(&server_url);
                    } else if event.id == quit_id {
                        std::process::exit(0);
                    }
                }
            }
        }
    }
}

async fn static_handler(uri: Uri) -> impl IntoResponse {
    let path = uri.path().trim_start_matches('/');
    let final_path = if path.is_empty() { "index.html" } else { path };

    match Assets::get(final_path) {
        Some(content) => {
            let body = Body::from(content.data);
            let mime_type = mime_guess::from_path(final_path).first_or_octet_stream();

            Response::builder()
                .header(header::CONTENT_TYPE, mime_type.as_ref())
                .body(body)
                .unwrap()
        }
        None => match Assets::get("index.html") {
            Some(content) => {
                let body = Body::from(content.data);
                Response::builder()
                    .header(header::CONTENT_TYPE, "text/html")
                    .body(body)
                    .unwrap()
            }
            None => Response::builder()
                .status(StatusCode::NOT_FOUND)
                .body(Body::from("404: Not Found - index.html is missing!"))
                .unwrap(),
        },
    }
}
