# Nise Chat

Nise Chat is a single Binary AI Chat Application for self-hosting. Features image and document uploads, web search,
resumable message streams with markdown and syntax highlighting, and more. It is designed to be easy to deploy and use,
with a focus on privacy and security. Nise Chat is built with Go and React, and uses PocketBase for data storage.
Initially built in 10 days for the T3 Cloneathon/Hackathon

Own all your data and pay only for what you use, with minimal 3rd party dependencies (only OpenRouter for inference) and
easy deployment.

Offers features like branching chats, text search, resumable streams, file uploads, and more.

See more at https://zaeem.dev/things/nise-chat

![Nise Chat](/docs/assets/nise-chat.png)

## Installation

Clone the repository and change into the project directory:

```sh
git clone https://github.com/JasirZaeem/nise-chat.git
cd nise-chat
```

Build the project and start the server:

```sh
make
./nise serve
```

This starts the server on port 8090 by default.

## First Run

Follow the link in the terminal output on the first run to create the
PocketBase super-user account.
![Super-user creation link](/docs/assets/pb-superuser-link.png)

Or you can run the following command to create the super-user account manually. (Replace `EMAIL` and
`PASS` with your desired email and password.)

```sh
`./nise superuser upsert EMAIL PASS`
```

## Configuration

### Authentication

By default, user registrations are disabled. You can visit the PocketBase admin dashboar at
`http://localhost:8090/_/`, login, and then create user accounts as needed. Make sure to mark them as verified to allow
them to login.

![Creating a user](/docs/assets/pb-create-user.png)

If you want to enable user registrations, edit the api rules for the `users` collection to allow creation operations.

![Editing the api rules](/docs/assets/pb-enable-registration.png)

And setup email credentials to allow PocketBase to send verification emails.
![Setting up email credentials](/docs/assets/pb-setup-smtp.png)

After which people can visit `/register` to create an account, and login once their email is verified.

### Data

When you run `./nise serve` it will use `./pb_data` to store the data for you app (database and uploaded files), and it will
create tables present in the database snapshot migration file in `./pb_migrations` (part of the repository). If you want to use another
location, pass the `--dir` flag for the data directory, and `--migrationsDir` for the migrations directory.

e.g.:

```sh
./nise serve --dir /path/to/data --migrationsDir /path/to/migrations
```

If using another location, place the `./pb_migrations` from the repository at that location first so PocketBase can run
initial migrations.

### Deploying

If not running locally and instead deploying to a server, follow the instructions at
`https://pocketbase.io/docs/going-to-production/` to manage a public facing instance.