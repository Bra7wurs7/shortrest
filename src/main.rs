use axum::{
    Router,
    body::Body,
    http::{StatusCode, Uri, header},
    response::{IntoResponse, Response},
};
use muda::{Menu, MenuEvent, MenuItem, PredefinedMenuItem};
use rust_embed::RustEmbed;
use std::net::SocketAddr;
use tray_icon::{Icon, TrayIconBuilder};

#[derive(RustEmbed)]
#[folder = "dist/"]
struct Assets;

const ICON_BYTES: &[u8] = include_bytes!("assets/favicon.png");

fn load_icon() -> Icon {
    let img = image::load_from_memory(ICON_BYTES)
        .expect("Failed to load embedded icon")
        .into_rgba8();
    let (width, height) = img.dimensions();
    let rgba = img.into_raw();
    Icon::from_rgba(rgba, width, height).expect("Failed to create icon")
}

fn main() {
    // Initialize GTK on Linux and suppress library deprecation warnings
    #[cfg(target_os = "linux")]
    {
        // SAFETY: Called at program start before spawning any threads,
        // so no concurrent access to environment variables is possible.
        unsafe {
            std::env::set_var("G_MESSAGES_DEBUG", "");
            std::env::set_var("G_MESSAGES_PREFIXED", "");
        }
        gtk::init().expect("Failed to initialize GTK");
    }

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

    // Platform-specific event loop
    #[cfg(target_os = "linux")]
    {
        // Linux: Use GTK main context for event processing
        let main_context = gtk::glib::MainContext::default();
        let menu_receiver = MenuEvent::receiver();
        loop {
            // Process GTK events
            while main_context.iteration(false) {}

            // Check menu events
            if let Ok(event) = menu_receiver.try_recv() {
                if event.id == open_id {
                    let _ = webbrowser::open(&server_url);
                } else if event.id == quit_id {
                    std::process::exit(0);
                }
            }
            std::thread::sleep(std::time::Duration::from_millis(50));
        }
    }

    #[cfg(target_os = "windows")]
    {
        // Windows: Simple message loop
        let menu_receiver = MenuEvent::receiver();
        loop {
            if let Ok(event) = menu_receiver.recv_timeout(std::time::Duration::from_millis(100)) {
                if event.id == open_id {
                    let _ = webbrowser::open(&server_url);
                } else if event.id == quit_id {
                    std::process::exit(0);
                }
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        // macOS: Need to run the native event loop
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
