#!/bin/bash

if ! [ "$(pgrep -f 'python3 watch.py')" ]
then
  echo "Dice not running. Starting up."
  export LC_ALL=en_US.utf8
  screen -dmS dice python3 watch.py
fi
