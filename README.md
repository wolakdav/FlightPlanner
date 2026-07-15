# FlightPlanner

## Run Backend And Frontend With One Script

A helper script is available at `./start-dev.sh` to launch the full local development stack following the existing project README guidance.

### How to run

From the repository root:

```bash
chmod +x ./start-dev.sh
./start-dev.sh
```

### What the script does

1. Verifies required commands are available (`redis-server`, `python3`, `npm`).
2. Starts Redis if it is not already running.
3. Attempts to apply `vm.overcommit_memory=1` before starting Redis (when permissions allow).
4. Loads airport data into Redis by running backend loader script.
5. Starts the backend Flask API on `http://localhost:5000`.
6. Runs frontend dependency install (`npm install`).
7. Starts the frontend Vite dev server on `http://localhost:5173`.
8. Writes service logs to `.logs/backend.log` and `.logs/frontend.log`.
9. Keeps both services running until you press `Ctrl+C`, then stops the backend and frontend processes it started.

### Notes

- Redis is started in daemon mode by the script when needed.
- If `sysctl` privileges are unavailable, the script continues and prints a warning.
