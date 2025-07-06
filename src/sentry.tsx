import * as Sentry from "@sentry/react";

if (process.env.NODE_ENV === 'production') {
    Sentry.init({
        dsn: "https://069c2c3bdf42a31e04ac86bdfde844af@o4508164578213888.ingest.us.sentry.io/4508164581163008",
    });
}
