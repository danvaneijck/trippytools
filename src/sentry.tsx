import { useEffect } from "react";
import * as Sentry from "@sentry/react";
import {
    createRoutesFromChildren,
    matchRoutes,
    useLocation,
    useNavigationType,
} from "react-router-dom";

if (process.env.NODE_ENV === 'production') {
    Sentry.init({
        dsn: "https://069c2c3bdf42a31e04ac86bdfde844af@o4508164578213888.ingest.us.sentry.io/4508164581163008",
        integrations: [
            Sentry.reactRouterV6BrowserTracingIntegration({
                useEffect,
                useLocation,
                useNavigationType,
                createRoutesFromChildren,
                matchRoutes,
            }),
            Sentry.replayIntegration(),
        ],
        tracesSampleRate: 1.0, // Reduce this in development, or set based on the environment
        replaysSessionSampleRate: 0.1, // Capture Replay for 10% of sessions
        replaysOnErrorSampleRate: 1.0, // Capture Replay for 100% of sessions with errors
    });
}
