#!/bin/bash

SESSION="drill"

if ! tmux has-session -t $SESSION 2>/dev/null; then
  # Window 0: protostone-processor
  tmux new-session -d -s $SESSION -c /home/jinmaa/github/drillMethane/protostone-processor
  tmux send-keys -t $SESSION "cd && cd /home/jinmaa/github/drillMethane/protostone-processor && npm run sync -- --network oylnet --start 0 --end 100000 --batch 20 --skip-existing" C-m

  # Window 1: METAGRAPHmain
  tmux new-window -t $SESSION:1 -n 'metagraph'
  tmux send-keys -t $SESSION:1 "cd && cd /home/jinmaa/github/drillMethane/METAGRAPH && npm run dev" C-m

  # Window 2: web-explorermain
  tmux new-window -t $SESSION:2 -n 'neo4j-explorer'
  tmux send-keys -t $SESSION:2 "cd && cd /home/jinmaa/github/drillMethane/protostone-processor/web-explorer && npm run dev" C-m
  
  # Window 3: continuous-sync service
  tmux new-window -t $SESSION:3 -n 'continuous-sync'
  tmux send-keys -t $SESSION:3 "cd && cd /home/jinmaa/github/drillMethane/protostone-processor && node web-explorer/continuous-sync.js" C-m
fi

tmux attach -t $SESSION
