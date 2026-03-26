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

    // On macOS/Windows: create the tao event loop before TrayIconBuilder because
    // it initialises NSApplication, which is required for NSStatusBar items.
    #[cfg(not(target_os = "linux"))]
    let event_loop = tao::event_loop::EventLoopBuilder::<()>::new().build();

    // Signal sent once the server is bound (or has failed).
    let (server_ready_tx, server_ready_rx) = std::sync::mpsc::channel::<()>();

    let server_url_clone = server_url.clone();
    std::thread::spawn(move || {
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async {
            match tokio::net::TcpListener::bind(&addr).await {
                Ok(listener) => {
                    println!("Server started successfully!");
                    println!("   Listening on http://{}", addr);

                    let app = Router::new().fallback(static_handler);

                    // When not using the desktop window, open the browser.
                    #[cfg(all(target_os = "linux", not(feature = "desktop")))]
                    if let Err(e) = webbrowser::open(&server_url_clone) {
                        eprintln!("Failed to open web browser: {}", e);
                        eprintln!("   Please navigate to {} manually.", server_url_clone);
                    }

                    server_ready_tx.send(()).ok();
                    axum::serve(listener, app).await.unwrap();
                }
                Err(e) => {
                    if e.to_string().contains("Address already in use") {
                        println!("Port 7777 is already in use.");
                        // Without desktop window, open the browser to the existing instance.
                        #[cfg(all(target_os = "linux", not(feature = "desktop")))]
                        if let Err(be) = webbrowser::open(&server_url_clone) {
                            eprintln!("Failed to open web browser: {}", be);
                            eprintln!("   Please navigate to {} manually.", server_url_clone);
                        }
                    } else {
                        eprintln!("Server failed to start: {:?}", e);
                        server_ready_tx.send(()).ok();
                        std::process::exit(1);
                    }
                    server_ready_tx.send(()).ok();
                    // Without desktop window, the process can exit.
                    #[cfg(all(target_os = "linux", not(feature = "desktop")))]
                    std::process::exit(0);
                }
            }
        });
    });

    // Wait for server to be ready before showing the UI.
    let _ = server_ready_rx.recv_timeout(std::time::Duration::from_secs(10));

    // Linux: spawn ksni tray (on background thread if desktop, blocking if not).
    #[cfg(target_os = "linux")]
    {
        let server_url_tray = server_url.clone();
        let spawn_tray = move || {
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
                server_url: server_url_tray,
                icon: ksni::Icon {
                    width: width as i32,
                    height: height as i32,
                    data: argb,
                },
            };

            let rt = tokio::runtime::Runtime::new().unwrap();
            rt.block_on(async {
                use ksni::TrayMethods as _;
                match tray.spawn().await {
                    Ok(_handle) => {
                        println!("   Tray icon active. Use it to quit or open in browser.");
                        std::future::pending::<()>().await
                    }
                    Err(e) => {
                        eprintln!("Tray icon unavailable ({}). Running without tray.", e);
                        eprintln!("   Press Ctrl+C to stop the server.");
                        std::future::pending::<()>().await
                    }
                }
            });
        };

        // With desktop feature, tray runs in background so the main thread
        // can run the tao/wry event loop. Without it, block here.
        #[cfg(feature = "desktop")]
        std::thread::spawn(spawn_tray);

        #[cfg(not(feature = "desktop"))]
        spawn_tray();
    }

    // Linux desktop window via GTK4 + WebKitGTK 6.
    #[cfg(all(target_os = "linux", feature = "desktop"))]
    {
        use adw::gtk::prelude::*;
        use adw::prelude::*;
        use webkit6::prelude::*;

        let app = adw::Application::builder()
            .application_id("io.shortrest.app")
            .build();

        let server_url_gtk = server_url.clone();
        app.connect_activate(move |app| {
            // Force dark color scheme so WebKitGTK renders native form controls
            // (e.g. <select> dropdowns) with dark styling to match the web UI.
            adw::StyleManager::default()
                .set_color_scheme(adw::ColorScheme::ForceDark);

            let window = adw::gtk::ApplicationWindow::builder()
                .application(app)
                .title("ShortRest")
                .default_width(1280)
                .default_height(800)
                .build();

            let webview = webkit6::WebView::new();
            webview.load_uri(&server_url_gtk);
            window.set_child(Some(&webview));
            window.present();
        });

        app.run_with_args::<String>(&[]);
    }

    // macOS/Windows desktop window via tao + wry.
    #[cfg(not(target_os = "linux"))]
    {
        use tao::{
            dpi::LogicalSize,
            event::{Event, WindowEvent},
            event_loop::ControlFlow,
            window::WindowBuilder,
        };

        let window = WindowBuilder::new()
            .with_title("ShortRest")
            .with_inner_size(LogicalSize::new(1280u32, 800u32))
            .build(&event_loop)
            .expect("Failed to create window");

        let _webview = wry::WebViewBuilder::new()
            .with_url(&server_url)
            .build(&window)
            .expect("Failed to create webview");

        let (_tray_icon, show_id, open_id, quit_id, menu_receiver) = {
            let menu = Menu::new();
            let show_item = MenuItem::new("Show Window", true, None);
            let open_item = MenuItem::new("Open in Browser", true, None);
            let quit_item = MenuItem::new("Quit", true, None);

            menu.append(&show_item).unwrap();
            menu.append(&open_item).unwrap();
            menu.append(&PredefinedMenuItem::separator()).unwrap();
            menu.append(&quit_item).unwrap();

            let show_id = show_item.id().clone();
            let open_id = open_item.id().clone();
            let quit_id = quit_item.id().clone();

            let tray_icon = TrayIconBuilder::new()
                .with_menu(Box::new(menu))
                .with_tooltip("ShortRest")
                .with_icon(load_icon())
                .build()
                .expect("Failed to create tray icon");

            (tray_icon, show_id, open_id, quit_id, MenuEvent::receiver())
        };

        event_loop.run(move |event, _, control_flow| {
            *control_flow = ControlFlow::WaitUntil(
                std::time::Instant::now() + std::time::Duration::from_millis(100),
            );

            if let Event::WindowEvent {
                event: WindowEvent::CloseRequested,
                ..
            } = event
            {
                window.set_visible(false);
            }

            while let Ok(ev) = menu_receiver.try_recv() {
                if ev.id == show_id {
                    window.set_visible(true);
                    window.set_focus();
                } else if ev.id == open_id {
                    let _ = webbrowser::open(&server_url);
                } else if ev.id == quit_id {
                    *control_flow = ControlFlow::Exit;
                }
            }
        });
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
