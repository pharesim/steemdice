#!/bin/bash

if ! [ "$(pgrep -f 'python3 watch.py')" ]
then
  echo "Dice not running. Starting up."
  screen -dmS dice python3 watch.py
fi
