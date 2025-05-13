# Ongoku CLI

> Command-line interface for Ongoku projects - manage schemas and synchronize changes between local development and the Ongoku platform.

## Overview

Ongoku CLI enables developers to:
- Work with Ongoku project schemas locally
- Synchronize changes between local environment and Ongoku web app
- Manage Git operations for project files

## Quick Start

```bash
# Install globally
npm install -g ongoku-cli

# Authenticate
ongoku login

# Clone project
ongoku clone project-name

# Make changes to project schema
cd project-name
# Edit files in goku_schema/app.schema.yml

# Push changes
ongoku push

# Pull latest changes
ongoku pull
```

## Key Commands

| Command | Description |
|---------|-------------|
| `login` | Authenticate with Ongoku |
| `clone` | Download project to local machine |
| `push`  | Upload schema changes to Ongoku |
| `pull`  | Fetch latest changes from Ongoku |
| `project` | Display current project details |
| `list`/`ls` | List available projects |

## Configuration

The CLI can be configured using environment variables:

| Environment Variable | Description | Default |
|----------------------|-------------|--------|
| `ONGOKU_API_URL` | Custom API endpoint URL | http://ongoku.com/api/cli |

## Development

For CLI development:
```bash
git clone https://github.com/build-ongoku/ongoku-cli.git
cd ongoku-cli
npm install
npm run build
npm link
```


### Commands for Development

- `npm run build`: Build the TypeScript source
- `npm run watch`: Watch for changes and rebuild
- `npm run test`: Run tests
- `npm run dev`: Run the CLI in development mode

## License

MIT
