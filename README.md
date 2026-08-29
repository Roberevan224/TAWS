# TAWS — Tech Axel Web Surfer

## Run directly from the Chromebook Linux Terminal

You do **not** need the `.deb` package.

Clone the repository:

```bash
git clone https://github.com/Roberevan224/TAWS.git
cd TAWS
```

Then start TAWS:

```bash
npm install
npm start
```

After the first install, future launches are simply:

```bash
cd ~/TAWS
npm start
```

### One-command launcher

The repository also includes `launch.sh`:

```bash
cd ~/TAWS
bash launch.sh
```

It installs dependencies automatically if `node_modules` is missing, then starts TAWS.

## Build packages (optional)

```bash
npm run dist
```

The browser itself does not require a `.deb` to run.
