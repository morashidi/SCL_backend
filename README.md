# SCL Backend

## Running it

Needs Node 22 and a Mongo you can reach. Copy `.env.example` to `.env`, fill in
`MONGO_URI` and `JWT_SECRET`, then:

```
npm install
npm start
```

It listens on `PORT` (5000 if you don't set one). Everything is mounted under
`/v1`, so a login goes to `http://localhost:5000/v1/auth/login`.

If Mongo isn't reachable the process exits instead of starting, so a silent
failure here is almost always a bad `MONGO_URI`.

## Seeding

Neither seeder is wired into npm. Run them directly.

```
node scripts/seed-users.js
```

**This wipes the users collection.** It deletes every user and every token
belonging to them, then inserts the five accounts below. It does dump whatever
it deleted to `backups/users-<timestamp>.json` first, so it's recoverable, but
don't point it at anything you care about.

```
node scripts/seed-test-user.js
```

This one is safe to re-run. It upserts a single admin for Postman and leaves
the rest of the users alone.

Both read `MONGO_URI` from `.env` and refuse to run without it.

## Seeded accounts

The five from `seed-users.js`. Password is `password123` for all of them.

| username       | role         | phone       |
| -------------- | ------------ | ----------- |
| karim.adel     | system_admin | 01001472583 |
| sherif.mansour | admin        | 01027461583 |
| yasmin.hegazy  | finance      | 01128374655 |
| omar.shalaby   | recruiter    | 01096472518 |
| ahmed.sayed    | mandoob      | 01274639182 |

And the one from `seed-test-user.js`:

| username       | password     | role         | phone       |
| -------------- | ------------ | ------------ | ----------- |
| postman_admin  | Postman123!  | system_admin | 01555000111 |

Obviously these are local-only credentials. Don't seed them anywhere public.
