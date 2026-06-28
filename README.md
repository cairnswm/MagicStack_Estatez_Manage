# Express Health API

A simple Node.js/Express API with TypeScript that provides a health check endpoint.

## Installation

```bash
npm install
```

## Environment Variables

Create a `.env` file in the root directory:

Use example.env for the correct format

BASE_PATH should match the path as deployed on the server

## Development

```bash
npm run dev
```

## Build

```bash
npm run build
```

This will:
- Compile TypeScript files to `dist/js/`
- Copy `package.json` to `dist/`
- Copy `.env` as `.env` to `dist/`
## Run Production

```bash
npm start
```

## API Endpoints

These are the initial endpoints, add and modify as required

- `GET /<serverpath>/` - Returns `{ "status": "node js app running" }`
- `GET /<serverpath>/health` - Returns `{ "status": "ok" }`
- `GET /<serverpath>/db/health` - Database health check endpoint that validates database connection
- `POST /<serverpath>/payment` - Proxies payment creation to the configured payments API
- `POST /<serverpath>/payment/webhook` - Receives payment webhook events and updates the `orders` table

## Payments

Set the following environment variables in `.env`:

- `MAGICSTACK_PAYMENT_API` - Base URL for the payment service
- `PAYMENT_APIKEY` - API key used as `X-APIKEY`

The webhook payload is stored in the `orders.metadata` column for audit purposes.


## Deployment

### SAetting up the server

1. Create the Directory 
2. Create an FTP user with the directory as their root 
3. <run deploy>
4. create a NodeJS application pointing to the above directory
- check the node version (20)
- run the npm start

### Deployment

``` bash
npm run deploy
```

This DOES NOT restart the app - this needs to be done manually