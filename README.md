# paket

A simple CLI for updating NPM packages throughout an entire workspace

## Usage

### Checking if updates are available

```bash
paket check <tag|version> <array of globs>
```

### Updating...

```bash
paket update <tag|version> <array of globs>
```

#### ...to version tagged latest

Updating `react`, `react-dom`, `@types/react` and `@types/react-dom` to the version tagged `latest`:

```bash
paket update latest react react-dom @types/react @types/react-dom
```