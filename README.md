[![Build Status](https://travis-ci.com/eweilow/paket.svg?branch=master)](https://travis-ci.com/eweilow/paket)
[![npm (scoped)](https://img.shields.io/npm/v/@eweilow/paket-cli.svg)](https://www.npmjs.com/package/@eweilow/paket-cli)
[![Renovate badge](https://badges.renovateapi.com/github/eweilow/paket)](https://renovatebot.com/)

# paket

A simple CLI for updating JS packages throughout an entire workspace

## Usage

### Checking if updates are available

```bash
paket check <latest|any> <array of globs>
```

### Updating...

```bash
paket update <latest|any> <array of globs>
```

#### ...to version tagged latest

Updating `react`, `react-dom`, `@types/react` and `@types/react-dom` to the version tagged `latest`:

```bash
paket update latest react react-dom @types/react @types/react-dom
```

#### ...to very latest (sorted by date)

Updating `react`, `react-dom`, `@types/react` and `@types/react-dom` to the very latest version (sorted by date):

```bash
paket update latest react react-dom @types/react @types/react-dom
```
