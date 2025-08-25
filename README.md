# shortrest
aims to become the most powerful tool for using language models to work with text

### using shortrest
To start using shortrest, download the latest release from the [releases tab](https://github.com/Bra7wurs7/shortrest/releases).

### developing shortrest
If you want to help with development on shortrest you might first need to follow these steps and enter these console commands:
1. Install a javascript runtime environment like [deno](https://deno.com/) or [nodejs](https://nodejs.org/en).
2. (Windows) Install [git](https://gitforwindows.org/) if you're on windows.
3. Clone this repository and open the downloaded directory:
- `git clone git@github.com:Bra7wurs7/shortrest.git`
- `cd shortrest`
4. Install the javascript packages that shortrest depends on:
- `deno i` or `npm i` depending on what js runtime you chose.
5. Start the application in development-mode:
- `deno run dev` or `npm run dev`
6. Open the applicaiton in your favorite browser by navigating to localhost:3000
- `firefox 127.0.0.1:3000`

### building shortrest
To build a single-file executable like what you can find in the [releases tab](https://github.com/Bra7wurs7/shortrest/releases), you might also have to follow these steps and enter these console commands:
1. Install the [rust](https://www.rust-lang.org/) toolchain. You can do this by visiting [rustup.rs](https://rustup.rs/).
2. Build the application in release mode:
- `deno run build-linux` for a great experience on linux, `deno run build-apple` for having fun on mac, or `reno run build-windows` for windows.
3. The build artefacts will be saved in ./target/{platform}/release

### supporting shortrest
I will soon contact my local tax office to figure out how to get this project funded
