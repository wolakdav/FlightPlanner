### Flight Planner

How to use

1. Start redis with `sudo sysctl vm.overcommit_memory=1 && redis-server --daemonize yes`
2. Load data
3. Start API server with `python -m flask --app  run src/e