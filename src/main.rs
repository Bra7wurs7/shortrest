use axum::{
    Router,
    body::Body,
    http::{StatusCode, Uri, header},
    response::{IntoResponse, Response},
};
use rust_embed::RustEmbed;
use std::net::SocketAddr;
use tokio::net::TcpListener;

// This struct is used by rust-embed to discover and embed the files.
// The `folder` attribute points to the directory relative to your Cargo.toml
// that you want to embed.
#[derive(RustEmbed)]
#[folder = "dist/"]
struct Assets;

// The main entry point of our application.
// `tokio::main` is a macro that sets up the asynchronous runtime.
#[tokio::main]
async fn main() {
    // Define the address and port the server will listen on.
    // 127.0.0.1 is localhost, meaning it's only accessible from the same machine.
    // Port 0 tells the OS to pick a random, available port.
    let addr = SocketAddr::from(([127, 0, 0, 1], 0));

    // Create a TCP listener that binds to the address.
    let listener = TcpListener::bind(addr).await.unwrap();

    // Get the actual address the OS assigned to us.
    let actual_addr = listener.local_addr().unwrap();
    println!("✅ Server started successfully!");
    println!("   Listening on http://{}", actual_addr);

    // Create the Axum router that defines our application's routes.
    // The `fallback` service is called for any request that doesn't match
    // another route. This is perfect for serving our single-page application,
    // as it will serve our assets or fall back to `index.html` for any
    // client-side routes.
    let app = Router::new().fallback(static_handler);

    // Open the default web browser to our server's address.
    let server_url = format!("http://{}", actual_addr);
    if let Err(e) = webbrowser::open(&server_url) {
        eprintln!("🔥 Failed to open web browser: {}", e);
        eprintln!("   Please navigate to {} manually.", server_url);
    }

    // Run the server with our Axum application.
    axum::serve(listener, app).await.unwrap();
}

/// Fallback handler for serving static files or the main `index.html`.
/// It takes a `Uri` extractor, which Axum provides with the request's URI.
async fn static_handler(uri: Uri) -> impl IntoResponse {
    // Get the path from the URI and remove the leading slash.
    let path = uri.path().trim_start_matches('/');

    // If the path is empty, it means the request was for the root (`/`).
    // In that case, we serve `index.html`. Otherwise, we use the path.
    let final_path = if path.is_empty() { "index.html" } else { path };

    // Use rust-embed to get the requested file.
    match Assets::get(final_path) {
        Some(content) => {
            // The file was found, so we serve it.
            let body = Body::from(content.data);
            // We use `mime_guess` to determine the correct Content-Type header.
            // This is crucial for the browser to correctly interpret the file
            // (e.g., as HTML, CSS, JavaScript).
            let mime_type = mime_guess::from_path(final_path).first_or_octet_stream();

            Response::builder()
                .header(header::CONTENT_TYPE, mime_type.as_ref())
                .body(body)
                .unwrap()
        }
        None => {
            // The file was not found in the embedded assets.
            // This is the crucial part for Single Page Applications (SPAs) like SolidJS.
            // If the user refreshes on a client-side route (e.g., /about), the server
            // won't find a file named "about". In this case, we must serve `index.html`
            // and let the client-side router handle it.
            match Assets::get("index.html") {
                Some(content) => {
                    let body = Body::from(content.data);
                    Response::builder()
                        .header(header::CONTENT_TYPE, "text/html")
                        .body(body)
                        .unwrap()
                }
                None => {
                    // This is a fallback for the fallback. If `index.html` is also missing,
                    // something is very wrong with the embedded assets.
                    Response::builder()
                        .status(StatusCode::NOT_FOUND)
                        .body(Body::from("404: Not Found - index.html is missing!"))
                        .unwrap()
                }
            }
        }
    }
}
