use axum::{
    Router,
    body::Body,
    http::{StatusCode, Uri, header},
    response::{IntoResponse, Response},
};
use rust_embed::RustEmbed;
use std::net::SocketAddr;
use tokio::net::TcpListener;

#[derive(RustEmbed)]
#[folder = "dist/"]
struct Assets;

#[tokio::main]
async fn main() {
    let addr = SocketAddr::from(([127, 0, 0, 1], 7777));

    match TcpListener::bind(&addr).await {
        Ok(listener) => {
            println!("✅ Server started successfully!");
            println!("   Listening on http://{}", addr);

            let app = Router::new().fallback(static_handler);

            let server_url = format!("http://{}", addr);
            if let Err(e) = webbrowser::open(&server_url) {
                eprintln!("🔥 Failed to open web browser: {}", e);
                eprintln!("   Please navigate to {} manually.", server_url);
            }

            axum::serve(listener, app).await.unwrap();
        }
        Err(e) => {
            if e.to_string().contains("Address already in use") {
                println!("🔥 Port 7777 is already in use!");
                let existing_url = format!("http://{}", addr);
                if let Err(browser_err) = webbrowser::open(&existing_url) {
                    eprintln!("🔥 Failed to open web browser: {}", browser_err);
                    eprintln!("   Please navigate to {} manually.", existing_url);
                }
            } else {
                eprintln!("❌ Server failed to start: {:?}", e);
            }

            std::process::exit(0);
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
